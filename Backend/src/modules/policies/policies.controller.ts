import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, ParseFilePipe,
  MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { PoliciesService }     from './policies.service';
import { JwtAuthGuard }        from '../auth/guards/jwt-auth.guard';
import { RbacGuard }           from '../../common/guards/rbac.guard';
import { Roles, CurrentUser }  from '../../common/decorators/roles.decorator';
import {
  CreatePolicyDto, UpdatePolicyDto, RecordPaymentDto,
  CreateMemberDto, CreateNomineeDto, PolicyQueryDto,
} from './dto/policy.dto';

@ApiTags('Policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('policies')
export class PoliciesController {
  constructor(private readonly svc: PoliciesService) {}

  @Get()
  @Roles(UserRole.EMPLOYEE)
  findAll(@CurrentUser() user: any, @Query() query: PolicyQueryDto) {
    return this.svc.findAll(user.tenantId, user.id, user.role, query);
  }

  @Get('expiring')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get policies expiring within N days' })
  expiring(@CurrentUser() user: any, @Query('days') days = 30) {
    return this.svc.getExpiringSoon(user.tenantId, +days);
  }

  @Get('plans')
  @Roles(UserRole.EMPLOYEE)
  listPlans(@CurrentUser() user: any, @Query('search') search?: string) {
    return this.svc.listInsurancePlans(user.tenantId, search);
  }

  @Get(':id')
  @Roles(UserRole.EMPLOYEE)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.findOne(user.tenantId, id, user.id, user.role);
  }

  @Post()
  @Roles(UserRole.EMPLOYEE)
  create(@CurrentUser() user: any, @Body() dto: CreatePolicyDto) {
    return this.svc.create(user.tenantId, dto, user.id, user.role);
  }

  @Post('full')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create policy with members and nominees in one request' })
  createFull(
    @CurrentUser() user: any,
    @Body() dto: { policy: CreatePolicyDto; members?: CreateMemberDto[]; nominees?: CreateNomineeDto[] },
  ) {
    return this.svc.createPolicyFull(user.tenantId, dto, user.id, user.role);
  }

  @Put(':id')
  @Roles(UserRole.EMPLOYEE)
  updateViaPut(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.svc.update(user.tenantId, id, dto, user.id, user.role);
  }

  @Patch(':id')
  @Roles(UserRole.EMPLOYEE)
  updateViaPatch(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdatePolicyDto,
  ) {
    return this.svc.update(user.tenantId, id, dto, user.id, user.role);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.remove(user.tenantId, id);
  }

  // ── Members ───────────────────────────────────────────────────────────────

  @Post(':id/members')
  @Roles(UserRole.EMPLOYEE)
  addMember(
    @CurrentUser() user: any,
    @Param('id') policyId: string,
    @Body() dto: CreateMemberDto,
  ) {
    return this.svc.addMember(user.tenantId, policyId, dto, user.id, user.role);
  }

  @Delete(':id/members/:memberId')
  @Roles(UserRole.EMPLOYEE)
  removeMember(
    @CurrentUser() user: any,
    @Param('id') policyId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.svc.removeMember(user.tenantId, policyId, memberId);
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  @Post(':id/payments')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Record a premium payment' })
  recordPayment(
    @CurrentUser() user: any,
    @Param('id') policyId: string,
    @Body() dto: RecordPaymentDto,
  ) {
    return this.svc.recordPayment(user.tenantId, policyId, dto, user.id, user.role);
  }

  // ── Nominees ──────────────────────────────────────────────────────────────

  @Post(':id/nominees')
  @Roles(UserRole.EMPLOYEE)
  addNominee(
    @CurrentUser() user: any,
    @Param('id') policyId: string,
    @Body() dto: CreateNomineeDto,
  ) {
    return this.svc.addNominee(user.tenantId, policyId, dto, user.id, user.role);
  }

  @Delete(':id/nominees/:nomineeId')
  @Roles(UserRole.EMPLOYEE)
  removeNominee(
    @CurrentUser() user: any,
    @Param('id') policyId: string,
    @Param('nomineeId') nomineeId: string,
  ) {
    return this.svc.removeNominee(user.tenantId, policyId, nomineeId);
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
  @ApiOperation({ summary: 'Import policies from a CSV file (max 5 MB)' })
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
    if (lines.length < 2) return { created: 0, skipped: [] };
    const [header, ...body] = lines;
    const keys = header.split(',').map(k => k.trim().replace(/^"|"$/g, ''));

    const rows = body.map(line => {
      const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      return Object.fromEntries(keys.map((k, i) => [k, values[i] ?? '']));
    });

    const mapped = rows.map((r: any) => ({
      policyNumber:     r['Policy Number']     ?? r.policyNumber     ?? '',
      status:           r['Status']            ?? r.status,
      sumAssured:       r['Sum Assured']       ?? r.sumAssured       ?? '',
      premiumAmount:    r['Premium Amount']    ?? r.premiumAmount    ?? '',
      paymentFrequency: r['Payment Frequency'] ?? r.paymentFrequency ?? '',
      startDate:        r['Start Date']        ?? r.startDate        ?? '',
      endDate:          r['End Date']          ?? r.endDate          ?? '',
      contactPhone:     r['Contact Phone']     ?? r.contactPhone     ?? '',
      planCode:         r['Plan Code']         ?? r.planCode,
    }));

    return this.svc.importPolicies(user.tenantId, user.id, mapped, user.role);
  }

  @Post('bulk-assign')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Bulk assign policies to an employee' })
  bulkAssign(
    @CurrentUser() user: any,
    @Body('ids') ids: string[],
    @Body('assignedEmployeeId') assignedEmployeeId: string | null,
  ) {
    return this.svc.bulkAssign(user.tenantId, ids, assignedEmployeeId, user.id, user.role);
  }
}
