import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserActivity, UserActivityDocument } from '../shared/schemas/user-activity.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { AdminDashboardStats,  EventAction, LoginEvent, UserActivityData, UserEvent } from './interfaces/common';


@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(UserActivity.name) private userActivityModel: Model<UserActivityDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async getLoginCount() {
    try {
      this.logger.log(`📊 Login count requested`);
      const totalLogins = await this.userActivityModel.countDocuments({
        activityType: EventAction.LOGIN
      });
      const data = {
        totalLogins,
        lastUpdated: new Date().toISOString(),
      };
      this.logger.log(`📈 Login count prepared: ${totalLogins} total logins`);
      return {
        success: true,
        data,
        message: 'Login count retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`❌ Error getting login count: ${error.message}`);
      return {
        success: false,
        error: 'Failed to retrieve login count',
        message: error.message,
      };
    }
  }

  async getDashboardStats(): Promise<{ success: boolean; data?: AdminDashboardStats; error?: string; message: string }> {
    try {
      this.logger.log(`📊 Dashboard stats requested`);

      // User Statistics
      const totalUsers = await this.userModel.countDocuments();
      const totalManagers = await this.userModel.countDocuments({ role: UserRole.MANAGER });
      const totalMembers = await this.userModel.countDocuments({ role: UserRole.MEMBER });

      // Authentication Statistics (only totalLogins)
      const totalLogins = await this.userActivityModel.countDocuments({
        activityType: EventAction.LOGIN,
      });


      const stats: AdminDashboardStats = {
        totalUsers,
        totalManagers,
        totalMembers,
        totalLogins,
      };

      this.logger.log(`📈 Dashboard stats prepared successfully`);
      return {
        success: true,
        data: stats,
        message: 'Dashboard statistics retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`❌ Error getting dashboard stats: ${error.message}`);
      return {
        success: false,
        error: 'Failed to retrieve dashboard statistics',
        message: error.message,
      };
    }
  }

  async getUserActivity(): Promise<{ success: boolean; data?: UserActivityData; error?: string; message: string }> {
    try {
      this.logger.log(`📊 User activity requested`);

    
      // Recent User Events (Last 10) - All user-related activities
      const recentUserEventsData = await this.userActivityModel
        .find({ 
          activityType: { 
            $in: [
              EventAction.LOGIN, 
              EventAction.USER_CREATED,
              EventAction.MANAGER_ADDED,
              EventAction.MANAGER_REMOVED,
              EventAction.MEMBER_ADDED,
              EventAction.MEMBER_REMOVED,
              EventAction.BECOME_MANAGER,
              EventAction.TASK_CREATED,
              EventAction.TASK_HIGH_PRIORITY,
              EventAction.TASK_DUE_DATE,
            ] 
          } 
        })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('userId', 'email firstName lastName role')
        .lean();



      const recentUserEvents: UserEvent[] = recentUserEventsData.map((activity: any) => {
        const populatedUser = activity.userId as any;
        const fallbackUserId = activity.userId; // may be ObjectId or null after populate

        const safeUserId = populatedUser?. _id?.toString?.() 
          ?? (typeof fallbackUserId === 'object' && fallbackUserId ? fallbackUserId.toString() : '');

        const firstName = populatedUser?.firstName ?? '';
        const lastName = populatedUser?.lastName ?? '';
        const userName = `${firstName} ${lastName}`.trim();

        return {
          userId: safeUserId,
          userEmail: populatedUser?.email ?? activity.userEmail ?? '',
          userName,
          userRole: populatedUser?.role ?? activity.userRole ?? '',
          action: activity.activityType as EventAction,
          timestamp: activity.activityTime ?? activity.createdAt ?? new Date(),
          details: activity.metadata,
          createdAt: activity.createdAt,
        } as UserEvent;
      });



      this.logger.log(`📈 User activity prepared successfully`);
      return {
        success: true,
        data: {
          recentUserEvents,
        },
        message: 'User activity retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`❌ Error getting user activity: ${error.message}`);
      return {
        success: false,
        error: 'Failed to retrieve user activity',
        message: error.message,
      };
    }
  }


} 