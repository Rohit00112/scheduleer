import { IsEnum, IsInt, IsObject, IsOptional, IsString, Max, Min } from "class-validator";

const PolicyTargetEnum = {
  request_create: "request_create",
  request_submit: "request_submit",
  approval_decide: "approval_decide"
} as const;

export class SimulatePolicyDto {
  @IsOptional()
  @IsEnum(PolicyTargetEnum)
  target?: "request_create" | "request_submit" | "approval_decide";

  @IsOptional()
  @IsString()
  requestType?: "schedule_change" | "room_booking";

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  riskScore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  blockingIssues?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  warningIssues?: number;

  @IsOptional()
  @IsString()
  actorRole?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
