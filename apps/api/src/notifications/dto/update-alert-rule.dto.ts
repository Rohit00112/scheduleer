import { IsBoolean, IsOptional } from "class-validator";

export class UpdateAlertRuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  channelInApp?: boolean;

  @IsOptional()
  @IsBoolean()
  channelEmail?: boolean;
}
