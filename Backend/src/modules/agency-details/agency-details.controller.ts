import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AgencyDetailsService } from './agency-details.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { SubscriptionGuard, RequireFeature } from '../../common/guards/subscription.guard';
import { CurrentUser, Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateAgencyDetailDto, UpdateAgencyDetailDto } from './dto/agency-details.dto';

@ApiTags('agency-details')
@ApiBearerAuth()
@Controller('agency-details')
@UseGuards(JwtAuthGuard, TenantGuard, RbacGuard, SubscriptionGuard)
@Roles(UserRole.OWNER)
@RequireFeature('branding')
export class AgencyDetailsController {
  constructor(private readonly agencyDetailsService: AgencyDetailsService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateAgencyDetailDto) {
    return this.agencyDetailsService.create(user.tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.agencyDetailsService.findAll(user.tenantId);
  }

  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateAgencyDetailDto) {
    return this.agencyDetailsService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.agencyDetailsService.remove(user.tenantId, id);
  }
}
