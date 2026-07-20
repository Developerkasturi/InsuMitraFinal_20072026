import {
  IsString, IsNumber, IsOptional, Min, Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateCommissionDto {
  @ApiProperty({ description: 'Policy ID' })
  @IsString()
  policyId: string;

  @ApiProperty({ description: 'Commission year ID' })
  @IsString()
  commissionYearId: string;

  @ApiProperty({ description: 'User ID of the beneficiary (employee receiving commission)' })
  @IsString()
  beneficiaryId: string;

  @ApiProperty({ description: 'Commission amount in INR', minimum: 0 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @ApiProperty({ description: 'Commission rate as a percentage (0–100)', minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  rate: number;

  // Base
  @IsOptional() @IsNumber() @Type(() => Number) basePremium?: number;
  @IsOptional() @IsNumber() @Type(() => Number) baseCommissionRate?: number;
  @IsOptional() @IsNumber() @Type(() => Number) baseCommissionAmount?: number;

  // Addon
  @IsOptional() @IsNumber() @Type(() => Number) addonPremium?: number;
  @IsOptional() @IsNumber() @Type(() => Number) addonCommissionRate?: number;
  @IsOptional() @IsNumber() @Type(() => Number) addonCommissionAmount?: number;

  // Deductible
  @IsOptional() @IsNumber() @Type(() => Number) deductibleRate?: number;
  @IsOptional() @IsNumber() @Type(() => Number) deductibleAmount?: number;

  // Monthly Grid
  @IsOptional() @IsNumber() @Type(() => Number) monthlyGridRate?: number;
  @IsOptional() @IsNumber() @Type(() => Number) monthlyGridAmount?: number;

  // Other
  @IsOptional() @IsNumber() @Type(() => Number) otherRate?: number;
  @IsOptional() @IsNumber() @Type(() => Number) otherAmount?: number;

  // Renewal
  @IsOptional() @IsNumber() @Type(() => Number) renewalRate?: number;
  @IsOptional() @IsNumber() @Type(() => Number) renewalAmount?: number;

  // Yearly splits
  @IsOptional() @IsNumber() @Type(() => Number) year1Commission?: number;
  @IsOptional() @IsNumber() @Type(() => Number) year2Commission?: number;
  @IsOptional() @IsNumber() @Type(() => Number) year3Commission?: number;
  @IsOptional() @IsNumber() @Type(() => Number) year4Commission?: number;
  @IsOptional() @IsNumber() @Type(() => Number) year5Commission?: number;

  @ApiPropertyOptional({ description: 'Optional notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateCommissionDto extends PartialType(CreateCommissionDto) {}

export class CreateCommissionYearDto {
  @ApiProperty({ example: 'FY 2025-26' })
  @IsString()
  name: string;

  @ApiProperty({ example: 2025 })
  @IsNumber()
  @Type(() => Number)
  year: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}
