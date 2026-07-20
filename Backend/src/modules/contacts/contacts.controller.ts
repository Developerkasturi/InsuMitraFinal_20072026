// ─────────────────────────────────────────────────────────────────────────────
// Contacts Controller — full CRM contact management (tenant-scoped)
// ─────────────────────────────────────────────────────────────────────────────
import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards, Res,
  UseInterceptors, UploadedFile, ParseFilePipe,
  MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { UserRole } from '@prisma/client';

import { ContactsService }    from './contacts.service';
import { JwtAuthGuard }       from '../auth/guards/jwt-auth.guard';
import { RbacGuard }          from '../../common/guards/rbac.guard';
import { Roles, CurrentUser } from '../../common/decorators/roles.decorator';
import { SubscriptionLimitInterceptor } from '../../common/interceptors/subscription-limit.interceptor';
import {
  CreateContactDto, UpdateContactDto,
  CreateAddressDto, CreateOccupationDto,
  CreateRelationshipDto, ContactFilterDto,
  BulkTagDto, BulkDeleteDto,
} from './dto/contact.dto';

@ApiTags('Contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@UseInterceptors(SubscriptionLimitInterceptor)
@Controller('contacts')
export class ContactsController {
  constructor(private readonly svc: ContactsService) {}

  // ── Collection endpoints ──────────────────────────────────────────────────

  @Get()
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'List contacts with filtering & pagination' })
  findAll(@CurrentUser() user: any, @Query() query: ContactFilterDto) {
    return this.svc.findAll(user.tenantId, query, user.id, user.role);
  }

  @Get('stats')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Contact statistics (total, gender breakdown, monthly additions)' })
  getStats(@CurrentUser() user: any) {
    return this.svc.getStats(user.tenantId);
  }

  @Get('upcoming-birthdays')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Contacts with birthdays in the next N days (default: 30)' })
  upcomingBirthdays(
    @CurrentUser() user: any,
    @Query('days') days = 30,
  ) {
    return this.svc.upcomingBirthdays(user.tenantId, +days);
  }

  @Get('export')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Export all active contacts as CSV' })
  async exportCsv(@CurrentUser() user: any, @Res() res: Response) {
    const csv = await this.svc.exportCsv(user.tenantId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    res.send(csv);
  }

  @Post('import')
  @Roles(UserRole.EMPLOYEE)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Import contacts from a CSV file (max 5 MB)' })
  async importCsv(
    @CurrentUser() user: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
          new FileTypeValidator({
            fileType: /(text\/csv|application\/vnd\.ms-excel)/,
            skipMagicNumbersValidation: true,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const csv  = file.buffer.toString('utf8');
    const lines = csv.split('\n').filter(l => l.trim());
    const [header, ...body] = lines;
    const keys = header.split(',').map(k => k.trim().replace(/^"|"$/g, ''));

    const rows = body.map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      return Object.fromEntries(keys.map((k, i) => [k, values[i] ?? '']));
    });

    // Map CSV headers to DTO fields (flexible: supports both human-readable and camelCase headers)
    const mapped = rows.map((r: any) => ({
      firstName:    r['First Name']    ?? r.firstName    ?? '',
      lastName:     r['Last Name']     ?? r.lastName     ?? '',
      phone:        r['Phone']         ?? r.phone        ?? '',
      email:        r['Email']         ?? r.email,
      gender:       r['Gender']        ?? r.gender,
      dateOfBirth:  r['Date of Birth'] ?? r.dateOfBirth,
      panNumber:    r['PAN Number']    ?? r.panNumber,
      annualIncome: r['Annual Income'] ?? r.annualIncome,
      tags:         r['Tags']          ?? r.tags,
      notes:        r['Notes']         ?? r.notes,
    }));

    return this.svc.importContacts(user.tenantId, user.id, mapped, user.role);
  }

  @Post('bulk-tag')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Add or remove tags from multiple contacts' })
  bulkTag(@CurrentUser() user: any, @Body() dto: BulkTagDto) {
    return this.svc.bulkTag(user.tenantId, dto);
  }

  @Post('bulk-delete')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Soft-delete multiple contacts' })
  bulkDelete(@CurrentUser() user: any, @Body() dto: BulkDeleteDto) {
    return this.svc.bulkDelete(user.tenantId, dto);
  }

  @Post('bulk')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Bulk import contacts from direct JSON data' })
  bulkImport(@CurrentUser() user: any, @Body() dto: { contacts: any[] }) {
    return this.svc.bulkImportContactsJson(user.tenantId, user.id, dto.contacts, user.role);
  }

  // ── Single-resource endpoints ─────────────────────────────────────────────

  @Get(':id')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get full contact profile with relationships & policies' })
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.findOne(user.tenantId, id, user.id, user.role);
  }

  @Post()
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create a new contact (checks for duplicate phone)' })
  create(@CurrentUser() user: any, @Body() dto: CreateContactDto) {
    return this.svc.create(user.tenantId, dto, user.id, user.role);
  }

  @Post('full')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create contact with address and occupation in one request' })
  createFull(
    @CurrentUser() user: any,
    @Body() dto: { contact: CreateContactDto; address?: CreateAddressDto; occupation?: CreateOccupationDto },
  ) {
    return this.svc.createContactFull(user.tenantId, dto, user.id, user.role);
  }

  @Put(':id')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Full update of a contact' })
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.svc.update(user.tenantId, id, dto, user.id, user.role);
  }

  @Patch(':id')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Partial update of a contact' })
  patch(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.svc.update(user.tenantId, id, dto, user.id, user.role);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Permanently delete a contact and all related data' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.remove(user.tenantId, id);
  }

  @Patch(':id/role')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update contact portal role and permissions' })
  updateContactRole(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: { role: string; permissions?: string[] },
  ) {
    return this.svc.updateContactRole(user.tenantId, id, dto.role, dto.permissions);
  }

  // ── Addresses ─────────────────────────────────────────────────────────────

  @Post(':id/addresses')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Add an address to a contact' })
  addAddress(
    @CurrentUser() user: any,
    @Param('id') contactId: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.svc.addAddress(user.tenantId, contactId, dto);
  }

  @Delete(':id/addresses/:addressId')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Remove an address from a contact' })
  removeAddress(
    @CurrentUser() user: any,
    @Param('id') contactId: string,
    @Param('addressId') addressId: string,
  ) {
    return this.svc.removeAddress(user.tenantId, contactId, addressId);
  }

  // ── Occupations ───────────────────────────────────────────────────────────

  @Post(':id/occupations')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Add an occupation record to a contact' })
  addOccupation(
    @CurrentUser() user: any,
    @Param('id') contactId: string,
    @Body() dto: CreateOccupationDto,
  ) {
    return this.svc.addOccupation(user.tenantId, contactId, dto);
  }

  @Delete(':id/occupations/:occId')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Remove an occupation record from a contact' })
  removeOccupation(
    @CurrentUser() user: any,
    @Param('id') contactId: string,
    @Param('occId') occupationId: string,
  ) {
    return this.svc.removeOccupation(user.tenantId, contactId, occupationId);
  }

  // ── Relationships ─────────────────────────────────────────────────────────

  @Post(':id/relationships')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Link two contacts with a relationship type (SPOUSE, CHILD, etc.)' })
  addRelationship(
    @CurrentUser() user: any,
    @Param('id') contactId: string,
    @Body() dto: CreateRelationshipDto,
  ) {
    return this.svc.addRelationship(user.tenantId, contactId, dto);
  }

  @Delete(':id/relationships/:relId')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Remove a relationship link between contacts' })
  removeRelationship(
    @CurrentUser() user: any,
    @Param('id') contactId: string,
    @Param('relId') relationshipId: string,
  ) {
    return this.svc.removeRelationship(user.tenantId, contactId, relationshipId);
  }

  // ── Activity log ──────────────────────────────────────────────────────────

  @Get(':id/activity')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Paginated activity log for a contact' })
  getActivity(
    @CurrentUser() user: any,
    @Param('id') contactId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.svc.getActivityLog(user.tenantId, contactId, +page, +limit);
  }

  @Post(':id/interaction')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Log contact interaction and update lead pipeline fields' })
  logInteraction(
    @CurrentUser() user: any,
    @Param('id') contactId: string,
    @Body() dto: {
      interactionType?: string; // Call, WhatsApp, Meeting
      leadStage?: string;
      leadStatus?: string;
      leadType?: string;
      nextFollowUp?: string;    // Date string
      notes?: string;           // Consultation Comment
    },
  ) {
    return this.svc.logInteraction(user.tenantId, contactId, user.id, dto);
  }

  @Post(':id/invite')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Send client portal invite to a contact (creates CONTACT user account)' })
  inviteToPortal(@CurrentUser() user: any, @Param('id') contactId: string) {
    return this.svc.inviteToPortal(user.tenantId, contactId);
  }
}

