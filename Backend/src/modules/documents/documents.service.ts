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
  title?: string;
  description?: string;
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

  private async resolveContactObjectId(tenantId: string, rawContactId?: string): Promise<string | null> {
    if (!rawContactId) return null;
    const isHex = /^[0-9a-fA-F]{24}$/.test(rawContactId);
    const contact = await this.prisma.contact.findFirst({
      where: {
        tenantId,
        OR: isHex
          ? [{ id: rawContactId }, { contactId: rawContactId }]
          : [{ contactId: rawContactId }],
      },
    });
    if (contact) return contact.id;
    return isHex ? rawContactId : null;
  }

  // ─── Upload ────────────────────────────────────────────────────────────────
  async upload(tenantId: string, file: Express.Multer.File, meta: UploadMeta) {
    const ext = path.extname(file.originalname);
    const key = `${tenantId}/${uuid()}${ext}`;
    let url: string;

    try {
      if (this.provider === 's3' && this.s3) {
        await this.s3.send(new PutObjectCommand({
          Bucket:      this.bucket,
          Key:         key,
          Body:        file.buffer,
          ContentType: file.mimetype,
        }));
        url = `https://${this.bucket}.s3.amazonaws.com/${key}`;
      } else if (this.provider === 'supabase' && this.supabase) {
        const { error } = await this.supabase.storage
          .from(this.bucket)
          .upload(key, file.buffer, { contentType: file.mimetype });
        if (error) throw new Error(error.message);
        url = this.supabase.storage.from(this.bucket).getPublicUrl(key).data.publicUrl;
      } else {
        url = `data:${file.mimetype || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`;
      }
    } catch (err: any) {
      console.warn(`Cloud storage upload failed (${err.message}). Falling back to data URL storage.`);
      url = `data:${file.mimetype || 'application/octet-stream'};base64,${file.buffer.toString('base64')}`;
    }

    const contactId = await this.resolveContactObjectId(tenantId, meta.contactId);

    const validDocTypes = Object.values(DocumentType);
    let docType: DocumentType = DocumentType.OTHER;
    if (meta.type) {
      if (validDocTypes.includes(meta.type as DocumentType)) {
        docType = meta.type as DocumentType;
      } else if (meta.type.includes('IDENTITY') || meta.type.includes('AADHAAR') || meta.type.includes('PAN')) {
        docType = DocumentType.KYC;
      } else if (meta.type.includes('POLICY')) {
        docType = DocumentType.POLICY_DOCUMENT;
      } else if (meta.type.includes('CLAIM') || meta.type.includes('DISCHARGE') || meta.type.includes('BILL') || meta.type.includes('REPORTS') || meta.type.includes('LETTER')) {
        docType = DocumentType.CLAIM_DOCUMENT;
      }
    }

    const doc = await this.prisma.document.create({
      data: {
        tenantId,
        name:        meta.title ? meta.title.trim() : file.originalname,
        mimeType:    file.mimetype,
        sizeBytes:   file.size,
        storageKey:  key,
        url,
        type:        docType,
        contactId,
        policyId:    meta.policyId  ?? null,
        claimId:     meta.claimId   ?? null,
      },
    });
    return { data: doc, message: 'Document uploaded successfully' };
  }

  // ─── List ──────────────────────────────────────────────────────────────────
  async findAll(tenantId: string, filters: { contactId?: string; policyId?: string; claimId?: string }) {
    const contactId = await this.resolveContactObjectId(tenantId, filters.contactId);
    const whereFilter: any = { tenantId };
    if (filters.contactId) {
      if (contactId) {
        whereFilter.contactId = contactId;
      } else {
        whereFilter.contactId = filters.contactId;
      }
    }
    if (filters.policyId) whereFilter.policyId = filters.policyId;
    if (filters.claimId) whereFilter.claimId = filters.claimId;

    const docs = await this.prisma.document.findMany({
      where: whereFilter,
      orderBy: { createdAt: 'desc' },
    });
    return { data: docs };
  }

  // ─── Presigned URL ─────────────────────────────────────────────────────────
  async getPresignedUrl(tenantId: string, id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Document not found');

    if (doc.url && doc.url.startsWith('data:')) {
      return { data: { url: doc.url } };
    }

    try {
      if (this.provider === 's3' && this.s3) {
        const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: doc.storageKey! });
        const signedUrl = await getSignedUrl(this.s3, cmd, { expiresIn: 900 });
        return { data: { url: signedUrl } };
      } else if (this.provider === 'supabase' && this.supabase) {
        const { data, error } = await this.supabase.storage
          .from(this.bucket)
          .createSignedUrl(doc.storageKey!, 900);
        if (!error && data?.signedUrl) {
          return { data: { url: data.signedUrl } };
        }
      }
    } catch (err: any) {
      console.warn(`Presigned URL generation failed: ${err.message}`);
    }
    return { data: { url: doc.url } };
  }

  // ─── Remove ────────────────────────────────────────────────────────────────
  async remove(tenantId: string, id: string) {
    const doc = await this.prisma.document.findFirst({ where: { id, tenantId } });
    if (!doc) throw new NotFoundException('Document not found');

    try {
      if (this.provider === 's3' && this.s3) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: doc.storageKey! }));
      } else if (this.provider === 'supabase' && this.supabase) {
        await this.supabase.storage.from(this.bucket).remove([doc.storageKey!]);
      }
    } catch (err: any) {
      console.warn(`Cloud storage deletion failed: ${err.message}`);
    }
    await this.prisma.document.delete({ where: { id } });
    try {
      await this.prisma.activityLog.create({
        data: {
          tenantId,
          entityType: 'Document',
          entityId: id,
          action: 'DELETE',
          description: 'Admin directly deleted the document',
        }
      });
    } catch (err: any) {
      // logger might not be injected in this service, so we ignore or console.log
      console.warn(`ActivityLog write failed for document delete: ${err.message}`);
    }
    return { message: 'Document deleted successfully' };
  }
}
