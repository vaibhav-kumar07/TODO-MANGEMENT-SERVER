import { IsString, IsOptional } from 'class-validator';

export class AdminUpdateUserPasswordDto {
  @IsString()
  @IsOptional()
  newPassword?: string; // Optional - if not provided, system will generate one
}
