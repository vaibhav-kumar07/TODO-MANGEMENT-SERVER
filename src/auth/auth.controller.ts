import { Controller, Post, Get, Put, Body, UseGuards, Request, HttpCode, HttpStatus, Logger, Query, Param } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AuthService } from './auth.service';
import { EmailService } from '../shared/email/email.service';

interface RequestWithUser extends ExpressRequest {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { ForgotPasswordGenerateDto } from './dto/forgot-password-generate.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { ManagerUpdateUserDto } from './dto/manager-update-user.dto';
import { AdminUpdateUserPasswordDto } from './dto/admin-update-user-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private authService: AuthService,
    private emailService: EmailService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signup(@Body() signupDto: SignupDto) {
    this.logger.log(`📝 Admin signup request - Email: ${signupDto.email}`);
    return this.authService.signup(signupDto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async inviteUser(@Body() inviteUserDto: InviteUserDto, @Request() req: RequestWithUser) {
    return this.authService.inviteUser(inviteUserDto, req.user);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: RequestWithUser) {
    this.logger.log(`🔍 Profile request - User ID: ${req.user.id}, Email: ${req.user.email}, Role: ${req.user.role}`);
    return this.authService.getProfile(req.user.id);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async getAllUsers(@Query() queryDto: QueryUsersDto, @Request() req: RequestWithUser) {
    this.logger.log(`👥 Users list request - User ID: ${req.user.id}, Email: ${req.user.email}, Role: ${req.user.role}`);
    this.logger.log(`👥 Query filters: ${JSON.stringify(queryDto)}`);
    return this.authService.getAllUsers(queryDto, req.user);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Body() updateProfileDto: UpdateProfileDto, @Request() req: RequestWithUser) {
    this.logger.log(`🔄 Profile update request - User ID: ${req.user.id}, Email: ${req.user.email}, Role: ${req.user.role}`);
    this.logger.log(`🔄 Request body: ${JSON.stringify(updateProfileDto)}`);
    
    try {
      const result = await this.authService.updateProfile(req.user.id, updateProfileDto);
      this.logger.log(`✅ Profile update successful for user: ${req.user.id}`);
      return result;
    } catch (error) {
      this.logger.error(`❌ Profile update failed for user: ${req.user.id}`, error.stack);
      throw error;
    }
  }

  // Unified endpoint for both admin and manager user updates
  @Put('users/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateUser(
    @Param('userId') userId: string,
    @Body() updateUserDto: AdminUpdateUserDto | ManagerUpdateUserDto,
    @Request() req: RequestWithUser
  ) {
    this.logger.log(`🔄 User updating user - Current User ID: ${req.user.id}, Target User ID: ${userId}`);
    this.logger.log(`🔄 Current user role: ${req.user.role}`);
    this.logger.log(`🔄 Update data: ${JSON.stringify(updateUserDto)}`);

    if (req.user.role === UserRole.ADMIN) {
      return this.authService.adminUpdateUser(userId, updateUserDto as AdminUpdateUserDto, req.user);
    } else if (req.user.role === UserRole.MANAGER) {
      return this.authService.managerUpdateUser(userId, updateUserDto as ManagerUpdateUserDto, req.user);
    } else {
      throw new Error('Only administrators and managers can update user profiles');
    }
  }



  @Post('forgot-password-generate')
  @HttpCode(HttpStatus.OK)
  async forgotPasswordGenerate(@Body() forgotPasswordGenerateDto: ForgotPasswordGenerateDto) {
    this.logger.log(`🔐 Forgot password generate request - Email: ${forgotPasswordGenerateDto.email}`);
    return this.authService.forgotPasswordGenerate(forgotPasswordGenerateDto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @Post('admin/reset-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminResetPassword(@Body() adminResetPasswordDto: AdminResetPasswordDto, @Request() req: RequestWithUser) {
    return this.authService.adminResetPassword(adminResetPasswordDto, req.user);
  }

  @Put('admin/users/:userId/password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async adminUpdateUserPassword(
    @Param('userId') userId: string,
    @Body() adminUpdateUserPasswordDto: AdminUpdateUserPasswordDto,
    @Request() req: RequestWithUser
  ) {
    this.logger.log(`🔐 Admin update user password request - Admin ID: ${req.user.id}, Target User ID: ${userId}`);
    return this.authService.adminUpdateUserPassword(userId, adminUpdateUserPasswordDto, req.user);
  }

  @Post('admin/users/:userId/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async adminDeleteUser(
    @Param('userId') userId: string,
    @Request() req: RequestWithUser,
  ) {
    this.logger.log(`🗑️ Admin delete user request - Admin ID: ${req.user.id}, Target User ID: ${userId}`);
    return this.authService.adminDeleteUser(userId, req.user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Request() req: RequestWithUser) {
    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    return this.authService.logout(token);
  }

  @Post('test-email')
  @HttpCode(HttpStatus.OK)
  async testEmail(@Body() body: { email: string }) {
    return this.emailService.testEmail(body.email);
  }

  @Get('email-status')
  @HttpCode(HttpStatus.OK)
  async getEmailStatus() {
    const emailUser = this.emailService['configService'].get('EMAIL_USER');
    const emailPass = this.emailService['configService'].get('EMAIL_PASS');
    
    return {
      emailConfigured: !!(emailUser && emailPass),
      emailUser: emailUser ? 'Set' : 'Not set',
      emailPass: emailPass ? 'Set' : 'Not set',
      message: emailUser && emailPass 
        ? 'Email service is configured' 
        : 'Email service is not configured. Set EMAIL_USER and EMAIL_PASS in .env file'
    };
  }
} 