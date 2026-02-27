import { IsArray, IsDateString, IsObject, IsOptional, IsString, MinLength } from "class-validator";

export class CreateScheduleChangeRequestDto {
  @IsString()
  @MinLength(4)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  changeItems?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
