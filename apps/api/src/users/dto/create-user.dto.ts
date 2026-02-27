import { IsArray, IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

const UserRoleEnum = {
  admin: "admin",
  staff: "staff",
  viewer: "viewer"
} as const;

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  displayName!: string;

  @IsEnum(UserRoleEnum)
  role!: "admin" | "staff" | "viewer";

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lecturerAliases?: string[];

  @IsOptional()
  @IsString()
  preferredWorkspace?: "admin" | "portal";

  @IsOptional()
  @IsString()
  timezone?: string;
}
