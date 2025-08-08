import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordGenerateDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
