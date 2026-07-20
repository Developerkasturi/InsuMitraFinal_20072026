import {
  IsString, IsOptional, IsEnum, IsNumber, IsMongoId, IsDateString, IsArray,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { LeadStage } from '@prisma/client';

export class CreateLeadDto {
  @ApiProperty({ description: 'Contact (prospect) ID' })
  @IsMongoId()
  contactId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  planId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assignedEmployeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional({ enum: LeadStage, default: LeadStage.CONTACTED })
  @IsOptional()
  @IsEnum(LeadStage)
  stage?: LeadStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sumAssuredRequired?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  premiumBudget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  followUpDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}

export class MoveLeadStageDto {
  @ApiProperty({ enum: LeadStage })
  @IsEnum(LeadStage)
  stage!: LeadStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Reason for losing the lead' })
  @IsOptional()
  @IsString()
  lostReason?: string;
}

export class LeadQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;

  @ApiPropertyOptional({ enum: LeadStage })
  @IsOptional()
  @IsEnum(LeadStage)
  stage?: LeadStage;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assignedEmployeeId?: string;

  @ApiPropertyOptional({ description: 'Filter leads by contact ID' })
  @IsOptional()
  @IsMongoId()
  contactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  followUpDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  followUpDateTo?: string;
}

export class AddConsultationDto {
  @ApiProperty()
  @IsString()
  notes!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;
}
