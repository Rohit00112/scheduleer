import { IsDateString, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateRoomBookingRequestDto {
  @IsString()
  @MinLength(4)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MaxLength(120)
  roomName!: string;

  @IsDateString()
  date!: string;

  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute!: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  endMinute!: number;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacityNeeded?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
