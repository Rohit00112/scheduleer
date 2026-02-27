import { Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

const PolicyTargetEnum = {
  request_create: "request_create",
  request_submit: "request_submit",
  approval_decide: "approval_decide"
} as const;

const PolicyEffectEnum = {
  allow: "allow",
  deny: "deny"
} as const;

export class CreatePolicyRuleDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsEnum(PolicyTargetEnum)
  target!: "request_create" | "request_submit" | "approval_decide";

  @IsOptional()
  @IsEnum(PolicyEffectEnum)
  effect?: "allow" | "deny";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  priority?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsObject()
  conditionsJson?: Record<string, unknown>;
}
