import { IsString, IsOptional, IsNotEmpty, IsBoolean, IsNumber, MaxLength } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateBannerDto {
  @ApiProperty({ description: 'Title of the banner', example: 'Summer Sale' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiProperty({ description: 'Image URL of the banner', example: 'https://example.com/banner.jpg' })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  linkUrl?: string;

  @ApiProperty({ required: false, default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ required: false, default: 0 })
  @IsNumber()
  @IsOptional()
  order?: number;
}

export class UpdateBannerDto extends PartialType(CreateBannerDto) {}
