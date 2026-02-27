import { IsOptional, IsString, MaxLength } from "class-validator";

export class SubmitChangeRequestDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
