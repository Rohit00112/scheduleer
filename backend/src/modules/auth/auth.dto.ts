import { IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../entities/user.entity';

export class LoginDto {
    @ApiProperty()
    @IsString()
    username: string;

    @ApiProperty()
    @IsString()
    password: string;
}

export class RegisterDto {
    @ApiProperty()
    @IsString()
    @MinLength(3)
    username: string;

    @ApiProperty()
    @IsString()
    @MinLength(6)
    password: string;

    @ApiProperty({ enum: UserRole, required: false, default: UserRole.USER })
    @IsOptional()
    @IsEnum(UserRole)
    role?: UserRole;
}
