import {
  Controller, Get, Post, Put, Delete, Patch,
  Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, ParseFilePipe,
  MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { LeadsService }        from './leads.service';
import { JwtAuthGuard }        from '../auth/guards/jwt-auth.guard';
import { RbacGuard }           from '../../common/guards/rbac.guard';
import { Roles, CurrentUser }  from '../../common/decorators/roles.decorator';
import { SubscriptionGuard, RequireFeature } from '../../common/guards/subscription.guard';
import {
  CreateLeadDto, UpdateLeadDto, MoveLeadStageDto,
  LeadQueryDto, AddConsultationDto,
} from './dto/lead.dto';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard, SubscriptionGuard)
@RequireFeature('leads')
@Controller('leads')
export class LeadsController {
  constructor(private readonly svc: LeadsService) {}

  /** Kanban board grouped by stage */
  @Get('board')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Kanban board view grouped by pipeline stage' })
  board(@CurrentUser() user: any) {
    return this.svc.getKanbanBoard(user.tenantId, user.id, user.role);
  }

  @Get()
  @Roles(UserRole.EMPLOYEE)
  findAll(@CurrentUser() user: any, @Query() query: LeadQueryDto) {
    return this.svc.findAll(user.tenantId, user.id, user.role, query);
  }

  @Get(':id')
  @Roles(UserRole.EMPLOYEE)
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.findOne(user.tenantId, id, user.id, user.role);
  }

  @Post()
  @Roles(UserRole.EMPLOYEE)
  create(@CurrentUser() user: any, @Body() dto: CreateLeadDto) {
    return this.svc.create(user.tenantId, dto, user.id, user.role);
  }

  @Put(':id')
  @Roles(UserRole.EMPLOYEE)
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.svc.update(user.tenantId, id, dto, user.id, user.role);
  }

  /** Move lead to a different pipeline stage */
  @Patch(':id/stage')
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Move lead to a pipeline stage' })
  moveStage(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: MoveLeadStageDto,
  ) {
    return this.svc.moveStage(user.tenantId, id, dto, user.id, user.role);
  }

  @Post(':id/consultations')
  @Roles(UserRole.EMPLOYEE)
  addConsultation(
    @CurrentUser() user: any,
    @Param('id') leadId: string,
    @Body() dto: AddConsultationDto,
  ) {
    return this.svc.addConsultation(user.tenantId, leadId, dto, user.id, user.role);
  }

  @Patch(':id/assignee')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update lead assignee' })
  updateAssignee(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('assignedEmployeeId') assignedEmployeeId: string | null,
  ) {
    return this.svc.updateLeadAssignee(user.tenantId, id, assignedEmployeeId, user.id);
  }

  @Post('bulk-assign')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Bulk assign leads to an employee' })
  bulkAssign(
    @CurrentUser() user: any,
    @Body('ids') ids: string[],
    @Body('assignedEmployeeId') assignedEmployeeId: string | null,
  ) {
    return this.svc.bulkAssignLeads(user.tenantId, ids, assignedEmployeeId, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.OWNER)
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.remove(user.tenantId, id);
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
  @ApiOperation({ summary: 'Import leads from a CSV file (max 5 MB)' })
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
      contactPhone:     r['Contact Phone']      ?? r.contactPhone     ?? '',
      contactFirstName: r['Contact First Name'] ?? r.contactFirstName ?? '',
      contactLastName:  r['Contact Last Name']  ?? r.contactLastName,
      planCode:         r['Plan Code']          ?? r.planCode,
      stage:            r['Stage']              ?? r.stage,
      notes:            r['Notes']              ?? r.notes,
    }));

    return this.svc.importLeads(user.tenantId, user.id, mapped, user.role);
  }
}
