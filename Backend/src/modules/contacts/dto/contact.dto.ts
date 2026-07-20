import {
  IsString, IsEmail, IsOptional, IsEnum, IsNumber,
  IsDateString, IsArray, IsBoolean, IsMongoId, Min, Max,
  IsIn, ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { Gender, RelationshipType } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Pagination / filter query
// ─────────────────────────────────────────────────────────────────────────────

export class PaginationDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(2000)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 'createdAt' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}

/** Extended filter used for GET /contacts */
export class ContactFilterDto extends PaginationDto {
  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({ description: 'Filter contacts who have ALL of these tags', type: [String] })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? [value] : value))
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'ISO date — include contacts born on or after this date' })
  @IsOptional()
  @IsDateString()
  dobFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date — include contacts born on or before this date' })
  @IsOptional()
  @IsDateString()
  dobTo?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({ description: 'Occupation type: SALARIED | SELF_EMPLOYED | BUSINESS | RETIRED | STUDENT' })
  @IsOptional()
  @IsString()
  occupationType?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Create / Update Contact
// ─────────────────────────────────────────────────────────────────────────────

export class CreateContactDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alternatePhone?: string;

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
  @IsString()
  panNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  annualIncome?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [String], example: ['vip', 'health'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  assignedEmployeeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadStage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  leadType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  followUpDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateContactDto extends PartialType(CreateContactDto) {}

// ─────────────────────────────────────────────────────────────────────────────
// Address
// ─────────────────────────────────────────────────────────────────────────────

export class CreateAddressDto {
  @ApiPropertyOptional({ default: 'HOME', enum: ['HOME', 'OFFICE', 'OTHER'] })
  @IsOptional()
  @IsIn(['HOME', 'OFFICE', 'OTHER'])
  type?: string = 'HOME';

  @ApiProperty()
  @IsString()
  line1: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty()
  @IsString()
  city: string;

  @ApiProperty()
  @IsString()
  state: string;

  @ApiProperty()
  @IsString()
  pincode: string;

  @ApiPropertyOptional({ default: 'India' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Occupation
// ─────────────────────────────────────────────────────────────────────────────

export class CreateOccupationDto {
  @ApiProperty({ example: 'SALARIED', enum: ['SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'RETIRED', 'STUDENT'] })
  @IsString()
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  yearsOfExp?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Relationships
// ─────────────────────────────────────────────────────────────────────────────

export class CreateRelationshipDto {
  @ApiProperty({ description: 'ObjectId of the related contact' })
  @IsMongoId()
  relatedContactId: string;

  @ApiProperty({ enum: RelationshipType, example: 'SPOUSE' })
  @IsEnum(RelationshipType)
  relationshipType: RelationshipType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk operations
// ─────────────────────────────────────────────────────────────────────────────

export class BulkTagDto {
  @ApiProperty({ description: 'List of contact ObjectIds to tag', type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  contactIds: string[];

  @ApiProperty({ description: 'Tags to add / remove', type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  tags: string[];

  @ApiPropertyOptional({ description: 'When true, remove these tags instead of adding', default: false })
  @IsOptional()
  @IsBoolean()
  remove?: boolean;
}

export class BulkDeleteDto {
  @ApiProperty({ description: 'List of contact ObjectIds to soft-delete', type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  contactIds: string[];
}
