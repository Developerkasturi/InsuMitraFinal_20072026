import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BannersService } from './banners.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { SubscriptionGuard, RequireFeature } from '../../common/guards/subscription.guard';
import { CurrentUser, Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateBannerDto, UpdateBannerDto } from './dto/banners.dto';

@ApiTags('banners')
@ApiBearerAuth()
@Controller('banners')
@UseGuards(JwtAuthGuard, TenantGuard, RbacGuard, SubscriptionGuard)
@Roles(UserRole.OWNER)
@RequireFeature('branding')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateBannerDto) {
    return this.bannersService.create(user.tenantId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.bannersService.findAll(user.tenantId);
  }

  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateBannerDto) {
    return this.bannersService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.bannersService.remove(user.tenantId, id);
  }
}
