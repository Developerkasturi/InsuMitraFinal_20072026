import { IsString, IsArray, IsOptional, IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePolicyScenarioDto {
  @ApiProperty({ description: 'Policy Type (HEALTH, TERM, LIFE, ACCIDENT, TRAVEL, GENERAL, MOTOR, etc.)' })
  @IsString()
  @IsNotEmpty()
  policyType: string;

  @ApiProperty({ description: 'Business Type (FRESH, PORT, RENEWAL)' })
  @IsString()
  @IsNotEmpty()
  businessType: string;

  @ApiProperty({ description: 'Insurance Company ID' })
  @IsString()
  @IsNotEmpty()
  companyId: string;

  @ApiProperty({ description: 'Insurance Plan ID' })
  @IsString()
  @IsNotEmpty()
  planId: string;

  @ApiProperty({ description: 'Supported Policy Periods (e.g. ["1 Yr", "2 Yr", "3 Yr"])', type: [String] })
  @IsArray()
  @IsString({ each: true })
  policyPeriods: string[];

  @ApiProperty({ description: 'Supported Premium Payment options (e.g. ["Full Payment", "EMI", "Monthly", "Quarterly", "Half-Yearly"])', type: [String] })
  @IsArray()
  @IsString({ each: true })
  paymentOptions: string[];

  @ApiPropertyOptional({ description: 'Supported EMI tenure options (e.g. ["3 Months", "6 Months", "12 Months", "24 Months", "36 Months"])', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emiMonths?: string[];

  @ApiPropertyOptional({ description: 'Supported Premium Payment Terms (e.g. ["1 to 99 Yr"])', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentTerms?: string[];

  @ApiPropertyOptional({ description: 'Is scenario active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdatePolicyScenarioDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  policyType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  policyPeriods?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentOptions?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  emiMonths?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentTerms?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class PolicyScenarioQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  policyType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  planId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: string | boolean;
}
