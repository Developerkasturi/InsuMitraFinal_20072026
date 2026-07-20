import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { DocumentType } from '@prisma/client';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

interface UploadMeta {
  contactId?: string;
  policyId?: string;
  claimId?: string;
  type?: string;
}

@Injectable()
export class DocumentsService {
  private s3?: S3Client;
  private supabase?: SupabaseClient;
  private readonly provider: string;
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.provider = config.get<string>('storage.provider', 's3');
    if (this.provider === 's3') {
      this.bucket = config.get<string>('aws.bucket', 'insumitra-docs');
      this.s3 = new S3Client({
        region: config.get<string>('aws.region', 'ap-south-1'),
        credentials: {
          accessKeyId:     config.get<string>('aws.accessKeyId', ''),
          secretAccessKey: config.get<string>('aws.secretAccessKey', ''),
        },
      });
    } else {
      this.bucket = config.get<string>('supabase.bucket', 'documents');
      const supabaseUrl = config.get<string>('supabase.url', '');
      const supabaseKey = config.get<string>('supabase.serviceKey', '');
      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey);
      }
    }
  }

  // ─── Upload ────────────────────────────────────────────────────────────────
  async upload(tenantId: string, file: Express.Multer.File, meta: UploadMeta) {
    const ext = path.extname(file.originalname);
    const key = `${tenantId}/${uuid()}${ext}`;
    let url: string;

    if (this.provider === 's3') {
      await this.s3!.send(new PutObjectCommand({
        Bucket:      this.bucket,
        Key:         key,
        Body:        file.buffer,
        ContentType: file.mimetype,
      }));
      url = `https://${this.bucket}.s3.amazonaws.com/${key}`;
    } else {
      const { error } = await this.supabase!.storage
        .from(this.bucket)
        .upload(key, file.buffer, { contentType: file.mimetype });
      if (error) throw new Error(error.message);
      url = this.supabase!.storage.from(this.bucket).getPublicUrl(key).data.publicUrl;
    }

    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        name:        file.originalname,
        mimeType:    file.mimetype,
        sizeBytes:   file.size,
        storageKey:  key,
        url,
        type:        (meta.type as DocumentType) ?? DocumentType.OTHER,
        contactId:   meta.contactId ?? null,
        policyId:    meta.policyId  ?? null,
        claimId:     meta.claimId   ?? null,
      },
    });
    return { data: doc, message: 'Document uploaded successfully' };
  }

  // ─── List ──────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, filters: { contactId?: string; policyId?: string; claimId?: string }) {
    const docs = await this.prisma.document.findMany({
      where: { tenantId, ...filters },
      orderBy: { createdAt: 'desc' },
    });
    return { data: docs };
  }

  // ─── Presigned URL ─────────────────────────────────────────────────────────
  async getPresignedUrl(tenantId: string, id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Document not found');

    if (this.provider === 's3') {
      const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: doc.storageKey! });
      const signedUrl = await getSignedUrl(this.s3!, cmd, { expiresIn: 900 });
      return { data: { url: signedUrl } };
    }
    // Supabase: create signed URL
    const { data, error } = await this.supabase!.storage
      .from(this.bucket)
      .createSignedUrl(doc.storageKey!, 900);
    if (error) throw new Error(error.message);
    return { data: { url: data.signedUrl } };
  }

  // ─── Remove ────────────────────────────────────────────────────────────────
  async remove(tenantId: string, id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Document not found');

    if (this.provider === 's3') {
      await this.s3!.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: doc.storageKey! }));
    } else {
      await this.supabase!.storage.from(this.bucket).remove([doc.storageKey!]);
    }
    await this.prisma.document.delete({ where: { id } });
    return { message: 'Document deleted successfully' };
  }
}
