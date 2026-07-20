import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { Roles, CurrentUser } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { FeedbackService } from './feedback.service';

@ApiTags('Feedback')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly svc: FeedbackService) {}

  @Post()
  @Roles(UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Submit feedback/suggestion about the platform' })
  submit(
    @CurrentUser() user: any,
    @Body('message') message: string,
    @Body('rating') rating?: number,
  ) {
    return this.svc.createFeedback(user.tenantId, user.id, message, rating);
  }

  @Get()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Get all feedback submitted by this tenant' })
  findAll(@CurrentUser() user: any) {
    return this.svc.getAllFeedback(user.tenantId);
  }
}
