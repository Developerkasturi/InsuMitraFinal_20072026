import {
  IsString, IsOptional, IsEnum, IsNumber, IsMongoId, IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ClaimStatus } from '@prisma/client';

export class CreateClaimDto {
  @ApiProperty()
  @IsMongoId()
  policyId: string;

  @ApiProperty()
  @IsMongoId()
  contactId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assignedEmployeeId?: string;

  @ApiProperty()
  @IsString()
  claimNumber: string;

  @ApiProperty({ example: 'HEALTH' })
  @IsString()
  claimType: string;   // DEATH | HEALTH | ACCIDENTAL | MATURITY

  @ApiProperty()
  @IsNumber()
  claimAmount: number;

  @ApiProperty()
  @IsDateString()
  intimatedAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  approvedAmount?: number;
}

export class UpdateClaimDto extends PartialType(CreateClaimDto) {}

export class UpdateClaimStatusDto {
  @ApiProperty({ enum: ClaimStatus })
  @IsEnum(ClaimStatus)
  status: ClaimStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  approvedAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  settledAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddExpenseDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiProperty()
  @IsString()
  category: string;

  @ApiProperty()
  @IsDateString()
  date: string;
}

export class ClaimQueryDto {
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

  @ApiPropertyOptional({ enum: ClaimStatus })
  @IsOptional()
  @IsEnum(ClaimStatus)
  status?: ClaimStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  claimType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignedEmployeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
