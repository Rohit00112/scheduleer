import { IsBoolean, IsOptional, IsUUID } from "class-validator";

export class CreateUserLecturerMappingDto {
  @IsUUID()
  userId!: string;

  @IsUUID()
  lecturerId!: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
