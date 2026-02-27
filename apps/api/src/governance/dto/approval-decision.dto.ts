import { IsOptional, IsString, MaxLength } from "class-validator";

export class ApprovalDecisionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
