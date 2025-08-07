import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Team, TeamDocument } from '../teams/schemas/team.schema';
import { LoginDto } from './dto/login.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { EmailService } from '../shared/email/email.service';
import { SeedService } from '../shared/database/seed.service';
import { ActivityLoggerService } from '../shared/services/activity-logger.service';
import { 
  throwValidationError, 
  throwAuthenticationError, 
  throwAuthorizationError, 
  throwBusinessError 
} from '../common/exceptions/business.exception';
import { JwtConfigKey } from '../config/environment.enum';
import { Types } from 'mongoose';
import { ManagerUpdateUserDto } from './dto/manager-update-user.dto';
import { DashboardGateway } from '../websocket/websocket.gateway';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private seedService: SeedService,
    private activityLogger: ActivityLoggerService,
    private dashboardGateway: DashboardGateway,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    const user = await this.userModel.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      throwAuthenticationError(
        'User not found or account is inactive',
        'No user exists with this email or the account has been deactivated'
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user!.password);
    if (!isPasswordValid) {
      throwAuthenticationError(
        'Email or password is incorrect',
        'The email address or password you entered is not valid'
      );
    }

    if (!user!.isEmailVerified) {
      throwValidationError(
        'Email verification required',
        'Please check your email and click the verification link before logging in'
      );
    }

    const payload = {
      sub: user!._id,
      email: user!.email,
      role: user!.role,
    };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: process.env[JwtConfigKey.REFRESH_SECRET] || 'refresh-secret',
    });

    // Log user login activity
    await this.activityLogger.logUserLogin(
      user!._id as any,
      user!.email,
      user!.role.toString(),
    );

    // Emit login event via WebSocket
    await this.dashboardGateway.emitLoginEvent(user!._id as any, {
      id: user!._id,
      email: user!.email,
      role: user!.role,
      name: `${user!.firstName} ${user!.lastName}`,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user!._id,
        email: user!.email,
        firstName: user!.firstName,
        lastName: user!.lastName,
        role: user!.role,
        teamId: user!.teamId,
      },
    };
  }

  async inviteUser(inviteUserDto: InviteUserDto, currentUser: any) {
    // Check if user can invite based on role
    if (currentUser.role === UserRole.MEMBER) {
      throwAuthorizationError(
        'Insufficient permissions to invite users',
        'Members cannot invite other users to the system'
      );
    }

    if (currentUser.role === UserRole.MANAGER && inviteUserDto.role === UserRole.MANAGER) {
      throwAuthorizationError(
        'Managers can only invite members',
        'You can only invite users with member role'
      );
    }

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email: inviteUserDto.email });
    if (existingUser) {
      throwBusinessError(
        'User with this email already exists',
        'A user account with this email address is already registered'
      );
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

    // Emit user created event via WebSocket
    await this.dashboardGateway.emitUserCreatedEvent(
      newUser._id as any,
      {
        id: newUser._id,
        email: newUser.email,
        role: newUser.role,
        name: `${newUser.firstName} ${newUser.lastName}`,
      },
      {
        id: currentUser.id,
        email: currentUser.email,
        role: currentUser.role,
      }
    );

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
        secret: process.env[JwtConfigKey.REFRESH_SECRET] || 'refresh-secret',
      });

      const user = await this.userModel.findById(payload.sub);
      if (!user || !user.isActive) {
        throwAuthenticationError(
          'Invalid refresh token',
          'The refresh token is invalid or the user account is inactive'
        );
      }

      const newPayload = {
        sub: user!._id,
        email: user!.email,
        role: user!.role,
      };

      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: '7d',
        secret: process.env[JwtConfigKey.REFRESH_SECRET] || 'refresh-secret',
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throwAuthenticationError(
        'Invalid refresh token',
        'The refresh token is invalid or has expired'
      );
    }
  }

  async getProfile(userId: string) {
    const user = await this.userModel.findById(userId).select('-password');
    if (!user) {
      throwAuthenticationError(
        'User not found',
        'The user account could not be found'
      );
    }

    return {
      id: user!._id,
      email: user!.email,
      firstName: user!.firstName,
      lastName: user!.lastName,
      role: user!.role,
      teamId: user!.teamId,
      isEmailVerified: user!.isEmailVerified,
      isActive: user!.isActive,
      createdAt: user!.createdAt,
    };
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
    const user = await this.userModel.findById(userId).select('+password');
    if (!user) {
      throwBusinessError(
        'User not found',
        'The user account you are trying to update does not exist'
      );
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
        throwValidationError(
          'Current password required',
          'You must provide your current password to change it'
        );
      }

      const isCurrentPasswordValid = await bcrypt.compare(updateProfileDto.currentPassword!, user!.password);
      if (!isCurrentPasswordValid) {
        throwValidationError(
          'Current password is incorrect',
          'The current password you entered is not valid'
        );
      }

      updateData.password = await bcrypt.hash(updateProfileDto.newPassword, 12);
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select('-password');

    if (!updatedUser) {
      throwBusinessError(
        'Profile update failed',
        'Unable to update the user profile'
      );
    }

    return {
      message: 'Profile updated successfully',
      user: {
        id: updatedUser?._id,
        email: updatedUser?.email,
        firstName: updatedUser?.firstName,
        lastName: updatedUser?.lastName,
        role: updatedUser?.role,
        teamId: updatedUser?.teamId,
        isEmailVerified: updatedUser?.isEmailVerified,
        isActive: updatedUser?.isActive,
        createdAt: updatedUser?.createdAt,
      },
    };
  }

  async getAllUsers(queryDto: any, currentUser: any) {
    this.logger.log(`🔍 Getting users with filters: ${JSON.stringify(queryDto)}`);

    // Check permissions - only admin and manager can see users
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.MANAGER) {
      throwAuthorizationError(
        'Insufficient permissions to view users',
        'Only administrators and managers can view user lists'
      );
    }

    const {
      page = 1,
      limit = 10,
      search,
      searchText,
      role,
      isActive
    } = queryDto;

    // Build filter
    const filter: any = {};

    // Search functionality
    const searchTerm = search || searchText;
    if (searchTerm) {
      filter.$or = [
        { email: { $regex: searchTerm, $options: 'i' } },
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    // Role filter
    if (role) {
      filter.role = role;
    }

    // Access control based on user role
    if (currentUser.role === UserRole.ADMIN) {
      // Admin can see all users (no additional filter)
      this.logger.log(`👑 Admin accessing all users`);
    } else if (currentUser.role === UserRole.MANAGER) {
      // Manager can only see members (not other managers or admins)
      filter.role = UserRole.MEMBER;
      this.logger.log(`👥 Manager accessing only members`);
    }

    // Status filters
    if (isActive !== undefined) {
      filter.isActive = isActive;
    }

    // Pagination
    const skip = (page - 1) * limit;
    
    // Execute query
    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-password')
        .populate('teamId', 'name')
        .populate('invitedBy', 'firstName lastName email')
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter)
    ]);

    this.logger.log(`✅ Found ${users.length} users out of ${total} total for ${currentUser.role} user`);

    return {
      users: users.map(user => ({
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        teamId: user.teamId,
        isEmailVerified: user.isEmailVerified,
        isActive: user.isActive,
        invitedBy: user.invitedBy,
        invitedAt: user.invitedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      }
    };
  }

  async adminUpdateUser(userId: string, updateUserDto: AdminUpdateUserDto, currentUser: any) {
    this.logger.log(`🔄 Admin updating user ID: ${userId} with data: ${JSON.stringify(updateUserDto)}`);

    if (currentUser.role !== UserRole.ADMIN) {
      throwAuthorizationError(
        'Administrator access required',
        'Only system administrators can update user profiles'
      );
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throwBusinessError(
        'User not found',
        'The user you are trying to update does not exist in our system'
      );
    }

    this.logger.log(`🎯 Target user found: ${user!.email} (${user!.role})`);

    // Admins cannot deactivate themselves
    if ((user!._id as any).toString() === currentUser.id && updateUserDto.isActive === false) {
      throwAuthorizationError(
        'Self-deactivation not allowed',
        'Administrators cannot deactivate their own accounts'
      );
    }

    // Role change validation for admins
    if (updateUserDto.role !== undefined) {
      const currentRole = user!.role;
      const newRole = updateUserDto.role;

      // Check for invalid demotions
      if (currentRole === UserRole.ADMIN && newRole === UserRole.MANAGER) {
        throwAuthorizationError(
          'Role demotion not allowed',
          'Administrators cannot demote admin accounts to manager role'
        );
      }

      if (currentRole === UserRole.MANAGER && newRole === UserRole.MEMBER) {
        throwAuthorizationError(
          'Role demotion not allowed',
          'Administrators cannot demote manager accounts to member role'
        );
      }

    }

    const updateData: any = {};

    // Update fields if provided
    if (updateUserDto.firstName !== undefined) {
      updateData.firstName = updateUserDto.firstName;
    }
    if (updateUserDto.lastName !== undefined) {
      updateData.lastName = updateUserDto.lastName;
    }
    if (updateUserDto.role !== undefined) {
      updateData.role = updateUserDto.role;
    }
    if (updateUserDto.teamId !== undefined) {
      updateData.teamId = updateUserDto.teamId;
    }
    if (updateUserDto.isActive !== undefined) {
      updateData.isActive = updateUserDto.isActive;
    }
    if (updateUserDto.isEmailVerified !== undefined) {
      updateData.isEmailVerified = updateUserDto.isEmailVerified;
    }

    const updatedUser = await this.userModel.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');

    if (!updatedUser) {
      throwBusinessError(
        'User update failed',
        'Unable to update the user profile. The user may no longer exist'
      );
    }

    // Emit user activated event if user was activated
    if (updateUserDto.isActive === true && !user?.isActive) {
      await this.dashboardGateway.emitUserActivatedEvent(
        updatedUser?._id as any,
        {
          id: updatedUser?._id,
          email: updatedUser?.email,
          role: updatedUser?.role,
          name: `${updatedUser?.firstName} ${updatedUser?.lastName}`,
        },
        {
          id: currentUser.id,
          email: currentUser.email,
          role: currentUser.role,
        }
      );
    }

    this.logger.log(`✅ User updated successfully: ${updatedUser?.email} (${updatedUser?.role})`);

    return {
      success: true,
      message: 'User updated successfully',
      data: {
        id: updatedUser?._id,
        email: updatedUser?.email,
        firstName: updatedUser?.firstName,
        lastName: updatedUser?.lastName,
        role: updatedUser?.role,
        isEmailVerified: updatedUser?.isEmailVerified,
        isActive: updatedUser?.isActive,
      },
    };
  }

  async managerUpdateUser(userId: string, updateUserDto: ManagerUpdateUserDto, currentUser: any) {
    this.logger.log(`🔄 Manager updating user - Manager ID: ${currentUser.id}, Target User ID: ${userId}`);
    this.logger.log(`🔄 Update data: ${JSON.stringify(updateUserDto)}`);

    // Validate user ID
    if (!Types.ObjectId.isValid(userId)) {
      throwValidationError(
        'Invalid user ID',
        'The provided user ID is not valid'
      );
    }

    // Get the target user
    const targetUser = await this.userModel.findById(userId);
    if (!targetUser) {
      throwBusinessError(
        'User not found',
        'The specified user does not exist'
      );
    }

    // Type assertion since we've already checked for null
    const user = targetUser as UserDocument;

    this.logger.log(`🎯 Target user found: ${user.email} (${user.role})`);

    // Managers cannot modify admins
    if (user.role === UserRole.ADMIN) {
      throwAuthorizationError(
        'Access denied',
        'Managers cannot modify administrator accounts'
      );
    }

    // Managers cannot modify other managers
    if (user.role === UserRole.MANAGER && (user._id as any).toString() !== currentUser.id) {
      throwAuthorizationError(
        'Access denied',
        'Managers cannot modify other manager accounts'
      );
    }

    // Managers cannot deactivate themselves
    if ((user._id as any).toString() === currentUser.id && updateUserDto.isActive === false) {
      throwAuthorizationError(
        'Self-deactivation not allowed',
        'Managers cannot deactivate their own accounts'
      );
    }

    // Role change validation - Managers cannot change roles at all
    if (updateUserDto.role !== undefined) {
      throwAuthorizationError(
        'Role modification not allowed',
        'Managers cannot change user roles. Only administrators can modify user roles.'
      );
    }

    // Build update data
    const updateData: any = {};
    
    if (updateUserDto.firstName !== undefined) {
      updateData.firstName = updateUserDto.firstName;
    }
    if (updateUserDto.lastName !== undefined) {
      updateData.lastName = updateUserDto.lastName;
    }
    if (updateUserDto.role !== undefined) {
      updateData.role = updateUserDto.role;
    }
    if (updateUserDto.isActive !== undefined) {
      updateData.isActive = updateUserDto.isActive;
    }

    // Update the user
    const updatedUser = await this.userModel.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');

    if (!updatedUser) {
      throwBusinessError(
        'User update failed',
        'Unable to update the user profile. The user may no longer exist'
      );
    }

    this.logger.log(`✅ User updated successfully by manager: ${updatedUser?.email} (${updatedUser?.role})`);

    return {
      success: true,
      message: 'User updated successfully',
      data: {
        id: updatedUser?._id,
        email: updatedUser?.email,
        firstName: updatedUser?.firstName,
        lastName: updatedUser?.lastName,
        role: updatedUser?.role,
        isActive: updatedUser?.isActive,
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
      { expiresIn: '1h', secret: process.env[JwtConfigKey.RESET_SECRET] || 'reset-secret' }
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
        secret: process.env[JwtConfigKey.RESET_SECRET] || 'reset-secret',
      });

      const user = await this.userModel.findById(payload.sub);
      if (!user || !user.isActive) {
        throwValidationError(
          'Invalid or expired reset token',
          'The password reset link is invalid or has expired'
        );
      }

      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      await this.userModel.findByIdAndUpdate(user?._id, { password: hashedPassword });
      return { message: 'Password reset successfully' };
    } catch (error) {
      throwValidationError(
        'Invalid or expired reset token',
        'The password reset link is invalid or has expired'
      );
    }
  }

  async adminResetPassword(adminResetPasswordDto: AdminResetPasswordDto, currentUser: any) {
    const { email, newPassword } = adminResetPasswordDto;

    // Check if current user is admin
    if (currentUser.role !== UserRole.ADMIN) {
      throwAuthorizationError(
        'Administrator access required',
        'Only system administrators can reset user passwords'
      );
    }

    const user = await this.userModel.findOne({ email });
    if (!user) {
      throwBusinessError(
        'User not found',
        'No user account exists with this email address'
      );
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userModel.findByIdAndUpdate(user?._id, { password: hashedPassword });

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