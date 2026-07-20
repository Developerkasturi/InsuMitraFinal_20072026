import { IsString, IsOptional, IsBoolean, IsEnum, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export enum EventTypeEnum {
  RENEWAL     = 'RENEWAL',
  PAYMENT_DUE = 'PAYMENT_DUE',
  BIRTHDAY    = 'BIRTHDAY',
  FOLLOWUP    = 'FOLLOWUP',
  MEETING     = 'MEETING',
  OTHER       = 'OTHER',
}

export class CreateCalendarEventDto {
  @IsString()
  title: string;

  @IsEnum(EventTypeEnum)
  eventType: EventTypeEnum;

  @IsDateString()
  startAt: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isAllDay?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  contactId?: string;

  @IsOptional()
  @IsString()
  relatedId?: string;
}

export class UpdateCalendarEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(EventTypeEnum)
  eventType?: EventTypeEnum;

  @IsOptional()
  @IsDateString()
  startAt?: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isAllDay?: boolean;

  @IsOptional()
  @IsString()
  description?: string;
}
