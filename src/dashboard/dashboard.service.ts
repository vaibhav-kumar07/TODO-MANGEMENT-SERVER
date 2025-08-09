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

      // Get current date ranges
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

      // Recent Logins (Last 10)
      const recentLoginsData = await this.userActivityModel
        .find({ activityType: EventAction.LOGIN })
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('userId', 'email firstName lastName role')
        .lean();

      const recentLogins: LoginEvent[] = recentLoginsData.map(activity => ({
        userId: (activity.userId as any)._id.toString(),
        userEmail: (activity.userId as any).email,
        userName: `${(activity.userId as any).firstName} ${(activity.userId as any).lastName}`,
        userRole: (activity.userId as any).role,
        timestamp: (activity as any).timestamp,
        ipAddress: (activity as any).metadata?.ipAddress,
        userAgent: (activity as any).metadata?.userAgent,
      }));

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
        .sort({ timestamp: -1 })
        .limit(10)
        .populate('userId', 'email firstName lastName role')
        .lean();

      const recentUserEvents: UserEvent[] = recentUserEventsData.map(activity => ({
        userId: (activity.userId as any)._id.toString(),
        userEmail: (activity.userId as any).email,
        userName: `${(activity.userId as any).firstName} ${(activity.userId as any).lastName}`,
        userRole: (activity.userId as any).role,
        action: (activity as any).activityType as EventAction,
        timestamp: (activity as any).timestamp,
        details: (activity as any).metadata,
      }));

      // Activity Summary
      const totalActivities = await this.userActivityModel.countDocuments();
      const activitiesToday = await this.userActivityModel.countDocuments({
        timestamp: { $gte: today }
      });
      const activitiesThisWeek = await this.userActivityModel.countDocuments({
        timestamp: { $gte: weekAgo }
      });
      const activitiesThisMonth = await this.userActivityModel.countDocuments({
        timestamp: { $gte: monthAgo }
      });

      const activityData: UserActivityData = {
        recentLogins,
        recentUserEvents,
        activitySummary: {
          totalActivities,
          activitiesToday,
          activitiesThisWeek,
          activitiesThisMonth,
        }
      };

      this.logger.log(`📈 User activity prepared successfully`);
      return {
        success: true,
        data: activityData,
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

  async getAdminDashboardData() { return this.getDashboardStats(); }
  async getManagerDashboardData(managerId: string) { return this.getDashboardStats(); }
  async getMemberDashboardData(memberId: string) { return this.getDashboardStats(); }
} 