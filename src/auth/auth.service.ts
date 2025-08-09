import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Team, TeamDocument } from '../teams/schemas/team.schema';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { ForgotPasswordGenerateDto } from './dto/forgot-password-generate.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AdminResetPasswordDto } from './dto/admin-reset-password.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminUpdateUserPasswordDto } from './dto/admin-update-user-password.dto';
import { EmailService } from '../shared/email/email.service';
import { SeedService } from '../shared/database/seed.service';
import { ActivityLoggerService } from '../shared/services/activity-logger.service'
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
import { EventSeverity,  EventAction, UserEvent } from '../dashboard/interfaces/common';

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

  private mapActivityUserDetails(user: UserDocument) {
    return {
      id: (user._id as any).toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      teamId: user.teamId ? (user.teamId as any).toString() : undefined,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
  
    };
  }

  private buildUserEvent(action: EventAction, user: UserDocument, details?: any): UserEvent {
    const firstName = user.firstName ?? '';
    const lastName = user.lastName ?? '';
    const userName = `${firstName} ${lastName}`.trim();
    return {
      userId: (user._id as any).toString(),
      userEmail: user.email,
      userName,
      userRole: user.role.toString(),
      action,
      timestamp: new Date(),
      details:{loginTime:new Date()},
      createdAt: (user as any).createdAt ?? new Date(),
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;
    console.log('email', email);
    console.log('password', password);
    const user = await this.userModel.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      throwAuthenticationError(
        'User not found or account is inactive',
        'No user exists with this email or the account has been deactivated'
      );
    }


    const isPasswordValid = await bcrypt.compare(password, user!.password);
    console.log('isPasswordValid', isPasswordValid);
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

    // Emit generic counters
    await this.dashboardGateway.emitUserEvent(EventAction.LOGIN, { isIncrement: true });

    // Emit detailed activity event
    await this.dashboardGateway.emitActivityEvent(
      EventAction.LOGIN,
      this.buildUserEvent(EventAction.LOGIN, user as any)
    );

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

  async signup(signupDto: SignupDto) {
    const { email, password, firstName, lastName } = signupDto;

    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throwValidationError(
        'Email already registered',
        'An account with this email address already exists'
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new admin user
    const newUser = new this.userModel({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role: UserRole.ADMIN,
      isEmailVerified: true,
      isActive: true,
    });

    await newUser.save();

    // Generate JWT tokens
    const payload = {
      sub: newUser._id,
      email: newUser.email,
      role: UserRole.ADMIN,
    };


    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
      secret: process.env[JwtConfigKey.REFRESH_SECRET] || 'refresh-secret',
    });

    // Log admin signup activity
    await this.activityLogger.logEvent(
      EventAction.USER_REGISTER,
      `New admin user registered: ${email}`,
      EventSeverity.LOW ,  
      newUser._id as any,
      newUser.email,
      newUser.role.toString(),
      { 
        action: 'ADMIN_SIGNUP',
        firstName,
        lastName,
        role: UserRole.ADMIN
      }
    );

    // Send welcome email to admin
    await this.emailService.sendAdminPasswordGenerated(
      newUser.email,
      newUser.firstName,
      newUser.lastName,
      password // Send the original password in email
    );
     // Emit generic counters
     await this.dashboardGateway.emitUserEvent(EventAction.USER_CREATED, { isIncrement: true });

     // Emit detailed activity event for user created
     await this.dashboardGateway.emitActivityEvent(
       EventAction.USER_CREATED,
       this.buildUserEvent(EventAction.USER_CREATED, newUser as any)
     );

    this.logger.log(`👑 New admin user created: ${email}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        isEmailVerified: newUser.isEmailVerified,
        isActive: newUser.isActive,
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

    // Emit generic counters for user created
    await this.dashboardGateway.emitUserEvent(EventAction.USER_CREATED, { isIncrement: true });

    // Emit detailed activity event
    const inviterDoc = await this.userModel.findById(currentUser.id);
    await this.dashboardGateway.emitActivityEvent(
      EventAction.USER_CREATED,
      this.buildUserEvent(EventAction.USER_CREATED, newUser as any, {
        performedBy: inviterDoc
          ? this.mapActivityUserDetails(inviterDoc as any)
          : {
              id: currentUser.id,
              email: currentUser.email,
              role: currentUser.role,
            },
      })
    );

    if (newUser.role === UserRole.MANAGER) {
      await this.dashboardGateway.emitUserEvent(EventAction.MANAGER_ADDED, { isIncrement: true });
    } else if (newUser.role === UserRole.MEMBER) {
      await this.dashboardGateway.emitUserEvent(EventAction.MEMBER_ADDED, { isIncrement: true });
    }

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

    // Emit detailed activity event
    await this.dashboardGateway.emitActivityEvent(
      EventAction.PROFILE_UPDATE,
      this.buildUserEvent(EventAction.PROFILE_UPDATE, updatedUser as any)
    );

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

    // NEW RESTRICTION: Admins can only activate/deactivate managers and members
    // They cannot deactivate other admins
    if (updateUserDto.isActive === false) {
      if (user!.role === UserRole.ADMIN) {
        throwAuthorizationError(
          'Admin deactivation not allowed',
          'Administrators cannot deactivate other admin accounts. Only managers and members can be deactivated.'
        );
      }
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
    const previousRole = user!.role;
    const previousActive = !!user!.isActive;

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

      // Activated
      if (updateUserDto.isActive === true ) {
        // Activation specific event counter can be derived by role added
        // Generic counters by role
        if (updatedUser?.role === UserRole.MEMBER && !previousActive) {
          await this.dashboardGateway.emitUserEvent(EventAction.MEMBER_ADDED, { isIncrement: true });
        }
        if (updatedUser?.role === UserRole.MANAGER && !previousActive) {
          await this.dashboardGateway.emitUserEvent(EventAction.MANAGER_ADDED, { isIncrement: true });
        }
      }

      // Deactivated
      if (updateUserDto.isActive === false ) {
        // Deactivation specific event counter can be derived by role removed
        // Generic counters by role
        if (updatedUser?.role === UserRole.MEMBER && previousActive) {
          await this.dashboardGateway.emitUserEvent(EventAction.MEMBER_REMOVED, { isIncrement: false });
        }
        if (updatedUser?.role === UserRole.MANAGER && previousActive) {
          await this.dashboardGateway.emitUserEvent(EventAction.MANAGER_REMOVED, { isIncrement: false });
        }
      }

      // Role elevation: MEMBER -> MANAGER
      if (updateUserDto.role !== undefined) {
        const newRole = updateUserDto.role;
        if (previousRole === UserRole.MEMBER && newRole === UserRole.MANAGER) {
          await this.dashboardGateway.emitUserEvent(EventAction.BECOME_MANAGER, { isIncrement: true });
          await this.dashboardGateway.emitUserEvent(EventAction.MANAGER_ADDED, { isIncrement: true });
        }
      }
    

    this.logger.log(`✅ User updated successfully: ${updatedUser?.email} (${updatedUser?.role})`);

    // Emit detailed activity events
    const adminDoc = await this.userModel.findById(currentUser.id);
    const performedBy = adminDoc ? this.mapActivityUserDetails(adminDoc as any) : {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
    };

    // Activation changes
    if (updateUserDto.isActive === true && !previousActive) {
      await this.dashboardGateway.emitActivityEvent(
        EventAction.USER_ACTIVATED,
        this.buildUserEvent(EventAction.USER_ACTIVATED, updatedUser as any, { performedBy })
      );
    }
    if (updateUserDto.isActive === false && previousActive) {
      await this.dashboardGateway.emitActivityEvent(
        EventAction.USER_DEACTIVATED,
        this.buildUserEvent(EventAction.USER_DEACTIVATED, updatedUser as any, { performedBy })
      );
    }

    // Role elevation
    if (updateUserDto.role !== undefined) {
      const newRole = updateUserDto.role;
      if (previousRole === UserRole.MEMBER && newRole === UserRole.MANAGER) {
        await this.dashboardGateway.emitActivityEvent(
          EventAction.BECOME_MANAGER,
          this.buildUserEvent(EventAction.BECOME_MANAGER, updatedUser as any, {
            performedBy,
            previousRole,
            newRole,
          })
        );
      }
    }

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
    const previousActive = !!user.isActive;
    
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

    // Emit detailed activity events
    const managerDoc = await this.userModel.findById(currentUser.id);
    const performedBy = managerDoc ? this.mapActivityUserDetails(managerDoc as any) : {
      id: currentUser.id,
      email: currentUser.email,
      role: currentUser.role,
    };

    if (updateUserDto.isActive === true && !previousActive) {
      await this.dashboardGateway.emitActivityEvent(
        EventAction.USER_ACTIVATED,
        this.buildUserEvent(EventAction.USER_ACTIVATED, updatedUser as any, { performedBy })
      );
    } else if (updateUserDto.isActive === false && previousActive) {
      await this.dashboardGateway.emitActivityEvent(
        EventAction.USER_DEACTIVATED,
        this.buildUserEvent(EventAction.USER_DEACTIVATED, updatedUser as any, { performedBy })
      );
    } else {
      await this.dashboardGateway.emitActivityEvent(
        EventAction.PROFILE_UPDATE,
        this.buildUserEvent(EventAction.PROFILE_UPDATE, updatedUser as any, { performedBy })
      );
    }

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


  async forgotPasswordGenerate(forgotPasswordGenerateDto: ForgotPasswordGenerateDto) {
    const { email } = forgotPasswordGenerateDto;

    const user = await this.userModel.findOne({ email });
    if (!user || !user.isActive) {
      // Don't reveal if user exists or not for security
      return { 
        success: true,
        message: 'If an account with this email exists, a new password has been generated and sent.' 
      };
    }

    // Generate new secure password
    const newPassword = this.generateSecurePassword();
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user's password
    await this.userModel.findByIdAndUpdate(user._id, { 
      password: hashedPassword,
      updatedAt: new Date()
    });

    // Log password reset activity
    await this.activityLogger.logEvent(
      EventAction.PASSWORD_RESET,
      `Password reset via forgot password for user: ${email}`,
      EventSeverity.MEDIUM,
      user._id as any,
      user.email,
      user.role.toString(),
      { 
        action: 'FORGOT_PASSWORD_GENERATE',
        resetMethod: 'email_generation'
      }
    );

    // Send new password email
    await this.emailService.sendForgotPasswordGenerated(
      user.email,
      user.firstName,
      user.lastName,
      newPassword
    );

    this.logger.log(`🔐 Password reset completed for user: ${email}`);

    // Emit detailed activity event
    await this.dashboardGateway.emitActivityEvent(
      EventAction.PASSWORD_RESET,
      this.buildUserEvent(EventAction.PASSWORD_RESET, user as any)
    );

    return { 
      success: true,
      message: 'If an account with this email exists, a new password has been generated and sent.' 
    };
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
      // Emit detailed activity event
      await this.dashboardGateway.emitActivityEvent(
        EventAction.PASSWORD_RESET_SUCCESS,
        this.buildUserEvent(EventAction.PASSWORD_RESET_SUCCESS, user as any)
      );
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

    // Emit detailed activity event
    const adminDoc = await this.userModel.findById(currentUser.id);
    await this.dashboardGateway.emitActivityEvent(
      EventAction.PASSWORD_RESET_SUCCESS,
      this.buildUserEvent(EventAction.PASSWORD_RESET_SUCCESS, user as any, {
        performedBy: adminDoc
          ? this.mapActivityUserDetails(adminDoc as any)
          : { id: currentUser.id, email: currentUser.email, role: currentUser.role },
      })
    );

    return { message: 'Password reset successfully by admin' };
  }

  async adminUpdateUserPassword(userId: string, adminUpdateUserPasswordDto: AdminUpdateUserPasswordDto, currentUser: any) {
    const { newPassword } = adminUpdateUserPasswordDto;

    // Check if current user is admin
    if (currentUser.role !== UserRole.ADMIN) {
      throwAuthorizationError(
        'Administrator access required',
        'Only system administrators can update user passwords'
      );
    }

    // Validate user ID format
    if (!Types.ObjectId.isValid(userId)) {
      throwValidationError(
        'Invalid user ID',
        'The provided user ID is not valid'
      );
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throwBusinessError(
        'User not found',
        'No user account exists with this ID'
      );
    }

    if (!user?.isActive) {
      throwBusinessError(
        'User account is inactive',
        'Cannot update password for an inactive user account'
      );
    }

    // Generate new password if not provided
    let generatedPassword: string;
    if (newPassword) {
      // Validate provided password
      if (newPassword.length < 6) {
        throwValidationError(
          'Password too short',
          'Password must be at least 6 characters long'
        );
      }
      generatedPassword = newPassword;
    } else {
      // Generate a secure random password
      generatedPassword = this.generateSecurePassword();
    }

    // Update password
    const hashedPassword = await bcrypt.hash(generatedPassword, 12);
    await this.userModel.findByIdAndUpdate(userId, { password: hashedPassword });

    // Log the activity
    await this.activityLogger.logEvent(
      EventAction.PASSWORD_RESET,
      `Admin ${currentUser.email} updated password for user ${user?.email}`,
      EventSeverity.HIGH,
      currentUser.id,
      currentUser.email,
      currentUser.role,
      { 
        action: 'UPDATE_USER_PASSWORD',
        targetUserId: userId, 
        targetUserEmail: user?.email, 
        passwordGenerated: !newPassword 
      }
    );

    // Send email with new password to user
    await this.emailService.sendNewPasswordGenerated(
      user?.email as string,
      user?.firstName as string,
      user?.lastName as string,
      generatedPassword,
      currentUser.email
    );

    this.logger.log(`🔐 Admin ${currentUser.email} updated password for user ${user?.email}`);

    // Emit detailed activity event
    const adminDoc2 = await this.userModel.findById(currentUser.id);
    await this.dashboardGateway.emitActivityEvent(
      EventAction.PASSWORD_RESET_SUCCESS,
      this.buildUserEvent(EventAction.PASSWORD_RESET_SUCCESS, user as any, {
        performedBy: adminDoc2
          ? this.mapActivityUserDetails(adminDoc2 as any)
          : { id: currentUser.id, email: currentUser.email, role: currentUser.role },
      })
    );

    return {
      success: true,
      message: newPassword ? 'User password updated successfully' : 'New password generated and sent to user email',
      data: {
        userId: user?._id,
        userEmail: user?.email,
        updatedBy: currentUser.email,
        updatedAt: new Date(),
        passwordGenerated: !newPassword,
        passwordSentToEmail: true
      }
    };
  }

  async adminDeleteUser(userId: string, currentUser: any) {
    this.logger.log(`🗑️ Admin delete request - Admin ID: ${currentUser.id}, Target User ID: ${userId}`);

    // Only admins can delete users
    if (currentUser.role !== UserRole.ADMIN) {
      throwAuthorizationError(
        'Administrator access required',
        'Only system administrators can delete users'
      );
    }

    // Validate user ID
    if (!Types.ObjectId.isValid(userId)) {
      throwValidationError(
        'Invalid user ID',
        'The provided user ID is not valid'
      );
    }

    const targetUser = await this.userModel.findById(userId);
    if (!targetUser) {
      throwBusinessError(
        'User not found',
        'The user you are trying to delete does not exist'
      );
    }
    const user = targetUser as UserDocument;

    // Prevent self-deletion and deleting admins
    if ((user._id as any).toString() === currentUser.id) {
      throwAuthorizationError(
        'Self-deletion not allowed',
        'Administrators cannot delete their own accounts'
      );
    }
    if (user.role === UserRole.ADMIN) {
      throwAuthorizationError(
        'Admin deletion not allowed',
        'Administrators cannot delete other administrator accounts'
      );
    }

    // Perform deletion
    await this.userModel.findByIdAndDelete(userId);

    // Emit generic and role-specific decrement counters
    await this.dashboardGateway.emitUserEvent(EventAction.USER_DELETED, { isIncrement: false });
    if (user.role === UserRole.MANAGER) {
      await this.dashboardGateway.emitUserEvent(EventAction.MANAGER_REMOVED, { isIncrement: false });
    } else if (user.role === UserRole.MEMBER) {
      await this.dashboardGateway.emitUserEvent(EventAction.MEMBER_REMOVED, { isIncrement: false });
    }

    // Emit detailed activity event
    const adminDoc = await this.userModel.findById(currentUser.id);
    await this.dashboardGateway.emitActivityEvent(
      EventAction.USER_DELETED,
      this.buildUserEvent(EventAction.USER_DELETED, user as any, {
        performedBy: adminDoc
          ? this.mapActivityUserDetails(adminDoc as any)
          : { id: currentUser.id, email: currentUser.email, role: currentUser.role },
      })
    );

    // Log event
    await this.activityLogger.logEvent(
      EventAction.USER_DELETED,
      `Admin ${currentUser.email} deleted user ${user.email}`,
      EventSeverity.HIGH,
      currentUser.id,
      currentUser.email,
      currentUser.role,
      {
        targetUserId: userId,
        targetUserEmail: user.email,
        targetUserRole: user.role,
      },
    );

    this.logger.log(`✅ User deleted successfully: ${user.email} (${user.role})`);

    return {
      success: true,
      message: 'User deleted successfully',
      data: {
        deletedUserId: userId,
        deletedUserEmail: user.email,
        deletedUserRole: user.role,
      },
    };
  }

  private generateSecurePassword(): string {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    
    // Ensure at least one character from each category
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // lowercase
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // uppercase
    password += '0123456789'[Math.floor(Math.random() * 10)]; // number
    password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // special character
    
    // Fill the rest randomly
    for (let i = 4; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }
    
    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  async logout(token: string) {
    try {
      const payload: any = this.jwtService.verify(token);
      const user = await this.userModel.findById(payload.sub);
      if (user) {
        // Log activity
        await this.activityLogger.logUserLogout(
          user._id as any,
          user.email,
          user.role.toString(),
          undefined,
          undefined,
        );

        // Emit counters
        await this.dashboardGateway.emitUserEvent(EventAction.LOGOUT, { isIncrement: true });

        // Emit detailed activity event
        await this.dashboardGateway.emitActivityEvent(
          EventAction.LOGOUT,
          this.buildUserEvent(EventAction.LOGOUT, user as any)
        );
      }
    } catch (e) {
      // ignore token errors for logout flow
    }
    return { message: 'Logged out successfully' };
  }
} 