import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, ParseFilePipe,
  MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { ClaimsService }       from './claims.service';
import { JwtAuthGuard }        from '../auth/guards/jwt-auth.guard';
import { RbacGuard }           from '../../common/guards/rbac.guard';
import { Roles, CurrentUser }  from '../../common/decorators/roles.decorator';
import { SubscriptionGuard, RequireFeature } from '../../common/guards/subscription.guard';
import {
  CreateClaimDto, UpdateClaimDto, UpdateClaimStatusDto,
  AddExpenseDto, ClaimQueryDto,
} from './dto/claim.dto';

@ApiTags('Claims')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard, SubscriptionGuard)
@RequireFeature('claims')
@Controller('claims')
export class ClaimsController {
  constructor(private readonly svc: ClaimsService) {}

  @Get('summary')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Claim counts by status' })
  summary(@CurrentUser() user: any) {
    return this.svc.getStatusSummary(user.tenantId);
  }

  @Get()
  @Roles(UserRole.EMPLOYEE)
  findAll(@CurrentUser() user: any, @Query() query: ClaimQueryDto) {
    return this.svc.findAll(user.tenantId, user.id, user.role, query);
  }

  @Get(':id')
  @Roles(UserRole.EMPLOYEE)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.findOne(user.tenantId, id, user.id, user.role);
  }

  @Post()
  @Roles(UserRole.EMPLOYEE)
  create(@CurrentUser() user: any, @Body() dto: CreateClaimDto) {
    return this.svc.create(user.tenantId, dto, user.id, user.role);
  }

  @Post('full')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Create claim with expenses in one request' })
  createFull(
    @CurrentUser() user: any,
    @Body() dto: { claim: CreateClaimDto; expenses?: AddExpenseDto[] },
  ) {
    return this.svc.createClaimFull(user.tenantId, dto, user.id, user.role);
  }

  @Put(':id')
  @Roles(UserRole.EMPLOYEE)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateClaimDto,
  ) {
    return this.svc.update(user.tenantId, id, dto, user.id, user.role);
  }

  @Patch(':id')
  @Roles(UserRole.EMPLOYEE)
  updateViaPatch(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateClaimDto,
  ) {
    return this.svc.update(user.tenantId, id, dto, user.id, user.role);
  }

  @Patch(':id/status')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Update claim status through its lifecycle' })
  updateStatus(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateClaimStatusDto,
  ) {
    return this.svc.updateStatus(user.tenantId, id, dto, user.id, user.role);
  }

  @Post(':id/expenses')
  @Roles(UserRole.EMPLOYEE)
  addExpense(
    @CurrentUser() user: any,
    @Param('id') claimId: string,
    @Body() dto: AddExpenseDto,
  ) {
    return this.svc.addExpense(user.tenantId, claimId, dto, user.id, user.role);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Delete a claim' })
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.remove(user.tenantId, id);
  }

  @Delete(':id/expenses/:expenseId')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Delete a claim expense' })
  removeExpense(
    @CurrentUser() user: any,
    @Param('id') claimId: string,
    @Param('expenseId') expenseId: string,
  ) {
    return this.svc.removeExpense(user.tenantId, claimId, expenseId, user.id, user.role);
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
  @ApiOperation({ summary: 'Import claims from a CSV file (max 5 MB)' })
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
      claimNumber:     r['Claim Number']     ?? r.claimNumber     ?? '',
      status:          r['Status']           ?? r.status,
      claimType:       r['Claim Type']       ?? r.claimType       ?? '',
      claimAmount:     r['Claim Amount']     ?? r.claimAmount     ?? '',
      intimatedAt:     r['Intimated At']     ?? r.intimatedAt     ?? '',
      policyNumber:    r['Policy Number']    ?? r.policyNumber    ?? '',
      contactPhone:    r['Contact Phone']    ?? r.contactPhone    ?? '',
    }));

    return this.svc.importClaims(user.tenantId, user.id, mapped, user.role);
  }
}
