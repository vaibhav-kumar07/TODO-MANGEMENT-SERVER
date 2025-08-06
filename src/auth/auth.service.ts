import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Team, TeamDocument } from '../teams/schemas/team.schema';
import { LoginDto } from './dto/login.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { EmailService } from '../shared/email/email.service';
import { SeedService } from '../shared/database/seed.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private seedService: SeedService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new BadRequestException('Please verify your email before logging in');
    }

    const payload = {
      sub: user._id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        teamId: user.teamId,
      },
    };
  }

  async inviteUser(inviteUserDto: InviteUserDto, currentUser: any) {
    // Check if user can invite based on role
    if (currentUser.role === UserRole.MEMBER) {
      throw new ForbiddenException('Members cannot invite users');
    }

    if (currentUser.role === UserRole.MANAGER && inviteUserDto.role === UserRole.MANAGER) {
      throw new ForbiddenException('Managers can only invite members');
    }

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email: inviteUserDto.email });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Generate secure password
    const password = await this.seedService.generateSecurePassword();
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create or get team
    let teamId = currentUser.teamId;
    if (inviteUserDto.teamName) {
      const newTeam = new this.teamModel({
        name: inviteUserDto.teamName,
        description: inviteUserDto.teamDescription || '',
        createdBy: currentUser.id,
        isActive: true,
      });
      const savedTeam = await newTeam.save();
      teamId = savedTeam._id;
    }

    // Create user
    const newUser = new this.userModel({
      email: inviteUserDto.email,
      firstName: inviteUserDto.firstName,
      lastName: inviteUserDto.lastName,
      password: hashedPassword,
      role: inviteUserDto.role,
      teamId,
      isEmailVerified: true, // Since admin/manager is creating
      isActive: true,
      invitedBy: currentUser.id,
      invitedAt: new Date(),
    });

    await newUser.save();

    // Send invitation email
    await this.emailService.sendUserInvitation(
      inviteUserDto.email,
      inviteUserDto.firstName,
      inviteUserDto.lastName,
      password,
      inviteUserDto.role,
      `${currentUser.firstName} ${currentUser.lastName}`,
    );

    return {
      message: 'User invited successfully',
      user: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        teamId: newUser.teamId,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      });

      const user = await this.userModel.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const newPayload = {
        sub: user._id,
        email: user.email,
        role: user.role,
      };

      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: '7d',
        secret: process.env.JWT_REFRESH_SECRET || 'refresh-secret',
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).select('-password');
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      teamId: user.teamId,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: any = {};

    // Update basic info
    if (updateProfileDto.firstName) {
      updateData.firstName = updateProfileDto.firstName;
    }
    if (updateProfileDto.lastName) {
      updateData.lastName = updateProfileDto.lastName;
    }

    // Update password if provided
    if (updateProfileDto.newPassword) {
      if (!updateProfileDto.currentPassword) {
        throw new BadRequestException('Current password is required to change password');
      }

      const isCurrentPasswordValid = await bcrypt.compare(updateProfileDto.currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      updateData.password = await bcrypt.hash(updateProfileDto.newPassword, 12);
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return {
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        teamId: updatedUser.teamId,
        isEmailVerified: updatedUser.isEmailVerified,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt,
      },
    };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    const user = await this.userModel.findOne({ email });
    if (!user || !user.isActive) {
      // Don't reveal if user exists or not for security
      return { message: 'If an account with this email exists, a password reset link has been sent.' };
    }

    // Generate reset token (valid for 1 hour)
    const resetToken = this.jwtService.sign(
      { sub: user._id, email: user.email },
      { expiresIn: '1h', secret: process.env.JWT_RESET_SECRET || 'reset-secret' }
    );

    // Send password reset email
    await this.emailService.sendPasswordReset(email, resetToken);

    return { message: 'If an account with this email exists, a password reset link has been sent.' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    try {
      // Verify reset token
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_RESET_SECRET || 'reset-secret',
      });

      const user = await this.userModel.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new BadRequestException('Invalid or expired reset token');
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await this.userModel.findByIdAndUpdate(user._id, { password: hashedPassword });

      return { message: 'Password reset successfully' };
    } catch (error) {
      throw new BadRequestException('Invalid or expired reset token');
    }
  }

  async adminResetPassword(adminResetPasswordDto: AdminResetPasswordDto, currentUser: any) {
    const { email, newPassword } = adminResetPasswordDto;

    // Check if current user is admin
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can reset user passwords');
    }

    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userModel.findByIdAndUpdate(user._id, { password: hashedPassword });

    // Send email notification to user
    await this.emailService.sendAdminPasswordResetNotification(email);

    return { message: 'Password reset successfully by admin' };
  }

  async logout(token: string) {
    // For now, we'll just return success
    // In a production system, you might want to blacklist the token
    // This would require a Redis store or database table for blacklisted tokens
    
    return { message: 'Logged out successfully' };
  }
} 