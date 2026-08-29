import { Controller, Delete, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { DocumentsService } from './documents.service';
import { SubscriptionGuard, RequireFeature } from '../../common/guards/subscription.guard';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard, SubscriptionGuard)
@RequireFeature('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  @Post('upload')
  @Roles(UserRole.OWNER, UserRole.EMPLOYEE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Query('contactId') contactId?: string,
    @Query('policyId') policyId?: string,
    @Query('claimId') claimId?: string,
    @Query('type') type?: string,
    @Query('title') title?: string,
    @Query('description') description?: string,
    @Req() req?: any,
  ) {
    const docTitle = title || req?.query?.title || req?.body?.title;
    const docDescription = description || req?.query?.description || req?.body?.description;
    return this.svc.upload(req.tenantId, file, { contactId, policyId, claimId, type, title: docTitle, description: docDescription });
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('contactId') contactId?: string,
    @Query('policyId') policyId?: string,
    @Query('claimId') claimId?: string,
  ) {
    return this.svc.findAll(req.tenantId, { contactId, policyId, claimId });
  }

  @Get(':id/url')
  getUrl(@Req() req: any, @Param('id') id: string) {
    return this.svc.getPresignedUrl(req.tenantId, id);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  remove(@Req() req: any, @Param('id') id: string) {
    return this.svc.remove(req.tenantId, id);
  }
}
