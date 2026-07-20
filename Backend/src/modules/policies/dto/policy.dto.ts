import {
  IsString, IsOptional, IsEnum, IsNumber, IsMongoId, IsDateString, IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { PolicyStatus, PaymentMode, PaymentFrequency, RelationshipType, Gender } from '@prisma/client';

// ── Policy ────────────────────────────────────────────────────────────────────

export class CreatePolicyDto {
  @ApiProperty()
  @IsString()
  policyNumber: string;

  @ApiProperty()
  @IsMongoId()
  contactId: string;

  @ApiProperty()
  @IsMongoId()
  planId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assignedEmployeeId?: string;

  @ApiPropertyOptional({ enum: PolicyStatus, default: PolicyStatus.ACTIVE })
  @IsOptional()
  @IsEnum(PolicyStatus)
  status?: PolicyStatus;

  @ApiProperty()
  @IsNumber()
  sumAssured: number;

  @ApiProperty()
  @IsNumber()
  premiumAmount: number;

  @ApiProperty({ enum: PaymentFrequency })
  @IsEnum(PaymentFrequency)
  paymentFrequency: PaymentFrequency;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  maturityDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  agentCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdatePolicyDto extends PartialType(CreatePolicyDto) {}

// ── Policy Member ─────────────────────────────────────────────────────────────

export class CreateMemberDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: RelationshipType })
  @IsEnum(RelationshipType)
  relationship: RelationshipType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  sumInsured?: number;
}

// ── Payment ───────────────────────────────────────────────────────────────────

export class RecordPaymentDto {
  @ApiProperty()
  @IsNumber()
  amount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @ApiPropertyOptional({ enum: PaymentMode })
  @IsOptional()
  @IsEnum(PaymentMode)
  mode?: PaymentMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPaid?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lateFee?: number;
}

// ── Nominee ───────────────────────────────────────────────────────────────────

export class CreateNomineeDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: RelationshipType })
  @IsEnum(RelationshipType)
  relationship: RelationshipType;

  @ApiProperty()
  @IsNumber()
  sharePercent: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;
}

// ── Query ─────────────────────────────────────────────────────────────────────

export class PolicyQueryDto {
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

  @ApiPropertyOptional({ enum: PolicyStatus })
  @IsOptional()
  @IsEnum(PolicyStatus)
  status?: PolicyStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  contactId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  planId?: string;

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
  @IsDateString()
  endDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextDueDateFrom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextDueDateTo?: string;
}
