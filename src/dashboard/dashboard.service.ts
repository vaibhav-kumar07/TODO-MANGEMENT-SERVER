import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserActivity, UserActivityDocument } from '../shared/schemas/user-activity.schema';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';

// Comprehensive event types for admin tracking
export enum EventType {
  // Authentication Events
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  FORGOT_PASSWORD = 'FORGOT_PASSWORD',
  
  // User Management Events
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  USER_CREATED = 'USER_CREATED',
  USER_DELETED = 'USER_DELETED',
  USER_INVITED = 'USER_INVITED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',
  
  // Task Management Events
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_DELETED = 'TASK_DELETED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',
  
  // Team Management Events
  TEAM_CREATED = 'TEAM_CREATED',
  TEAM_UPDATED = 'TEAM_UPDATED',
  TEAM_DELETED = 'TEAM_DELETED',
  MEMBER_ADDED = 'MEMBER_ADDED',
  MEMBER_REMOVED = 'MEMBER_REMOVED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  
  // System Events
  ADMIN_ACTION = 'ADMIN_ACTION',
  SYSTEM_BACKUP = 'SYSTEM_BACKUP',
  ERROR_LOGGED = 'ERROR_LOGGED',
  PERFORMANCE_ALERT = 'PERFORMANCE_ALERT',
}

// Interfaces for dashboard data
export interface LoginEvent {
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface UserEvent {
  userId: string;
  userEmail: string;
  userName: string;
  userRole: string;
  action: EventType;
  timestamp: Date;
  details?: any;
}

export interface DashboardStats {
  // User Statistics
  totalUsers: number;
  totalManagers: number;
  totalMembers: number;
  activeManagers: number;
  inactiveManagers: number;
  activeMembers: number;
  inactiveMembers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  newManagersToday: number;
  newMembersToday: number;
  
  // Authentication Statistics
  totalLogins: number;
  loginsToday: number;
  loginsThisWeek: number;
  loginsThisMonth: number;
  failedLoginsToday: number;
  failedLoginsThisWeek: number;
  passwordResetsToday: number;
  forgotPasswordRequests: number;
  
  // Task Statistics
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  tasksCreatedToday: number;
  tasksCompletedToday: number;
  tasksUpdatedToday: number;
  
  // Team Statistics
  totalTeams: number;
  activeTeams: number;
  inactiveTeams: number;
  teamsCreatedToday: number;
  membersAddedToday: number;
  membersRemovedToday: number;
  
  // Activity Summary
  totalActivities: number;
  activitiesToday: number;
  activitiesThisWeek: number;
  activitiesThisMonth: number;
  uniqueActiveUsersToday: number;
  uniqueActiveUsersThisWeek: number;
}

export interface UserActivityData {
  recentLogins: LoginEvent[];
  recentUserEvents: UserEvent[];
  activitySummary: {
    totalActivities: number;
    activitiesToday: number;
    activitiesThisWeek: number;
    activitiesThisMonth: number;
  };
}

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
        activityType: EventType.LOGIN
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

  async getDashboardStats(): Promise<{ success: boolean; data?: DashboardStats; error?: string; message: string }> {
    try {
      this.logger.log(`📊 Dashboard stats requested`);

      // Get current date ranges
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

      // User Statistics
      const totalUsers = await this.userModel.countDocuments();
      const totalManagers = await this.userModel.countDocuments({ role: UserRole.MANAGER });
      const totalMembers = await this.userModel.countDocuments({ role: UserRole.MEMBER });
      
      // Active/Inactive Users by Role
      const activeManagers = await this.userModel.countDocuments({
        isActive: true,
        role: UserRole.MANAGER
      });
      
      const activeMembers = await this.userModel.countDocuments({
        isActive: true,
        role: UserRole.MEMBER
      });
      
      const inactiveManagers = totalManagers - activeManagers;
      const inactiveMembers = totalMembers - activeMembers;
      
      // New User Growth
      const newUsersToday = await this.userModel.countDocuments({
        createdAt: { $gte: today }
      });
      const newUsersThisWeek = await this.userModel.countDocuments({
        createdAt: { $gte: weekAgo }
      });
      const newUsersThisMonth = await this.userModel.countDocuments({
        createdAt: { $gte: monthAgo }
      });
      const newManagersToday = await this.userModel.countDocuments({
        createdAt: { $gte: today },
        role: UserRole.MANAGER
      });
      const newMembersToday = await this.userModel.countDocuments({
        createdAt: { $gte: today },
        role: UserRole.MEMBER
      });

      // Authentication Statistics
      const totalLogins = await this.userActivityModel.countDocuments({
        activityType: EventType.LOGIN
      });
      const loginsToday = await this.userActivityModel.countDocuments({
        activityType: EventType.LOGIN,
        timestamp: { $gte: today }
      });
      const loginsThisWeek = await this.userActivityModel.countDocuments({
        activityType: EventType.LOGIN,
        timestamp: { $gte: weekAgo }
      });
      const loginsThisMonth = await this.userActivityModel.countDocuments({
        activityType: EventType.LOGIN,
        timestamp: { $gte: monthAgo }
      });
      
      const failedLoginsToday = await this.userActivityModel.countDocuments({
        activityType: EventType.LOGIN_FAILED,
        timestamp: { $gte: today }
      });
      const failedLoginsThisWeek = await this.userActivityModel.countDocuments({
        activityType: EventType.LOGIN_FAILED,
        timestamp: { $gte: weekAgo }
      });
      
      const passwordResetsToday = await this.userActivityModel.countDocuments({
        activityType: EventType.PASSWORD_RESET,
        timestamp: { $gte: today }
      });
      
      const forgotPasswordRequests = await this.userActivityModel.countDocuments({
        activityType: EventType.FORGOT_PASSWORD,
        timestamp: { $gte: today }
      });

      // Task Statistics (placeholder for now)
      const totalTasks = 0;
      const completedTasks = 0;
      const pendingTasks = 0;
      const overdueTasks = 0;
      const tasksCreatedToday = 0;
      const tasksCompletedToday = 0;
      const tasksUpdatedToday = 0;

      // Team Statistics (placeholder for now)
      const totalTeams = 0;
      const activeTeams = 0;
      const inactiveTeams = 0;
      const teamsCreatedToday = 0;
      const membersAddedToday = 0;
      const membersRemovedToday = 0;

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
      
      const uniqueActiveUsersToday = await this.userActivityModel.distinct('userId', {
        timestamp: { $gte: today }
      }).then(ids => ids.length);
      
      const uniqueActiveUsersThisWeek = await this.userActivityModel.distinct('userId', {
        timestamp: { $gte: weekAgo }
      }).then(ids => ids.length);

      const stats: DashboardStats = {
        // User Statistics
        totalUsers,
        totalManagers,
        totalMembers,
        activeManagers,
        inactiveManagers,
        activeMembers,
        inactiveMembers,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        newManagersToday,
        newMembersToday,
        
        // Authentication Statistics
        totalLogins,
        loginsToday,
        loginsThisWeek,
        loginsThisMonth,
        failedLoginsToday,
        failedLoginsThisWeek,
        passwordResetsToday,
        forgotPasswordRequests,
        
        // Task Statistics
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        tasksCreatedToday,
        tasksCompletedToday,
        tasksUpdatedToday,
        
        // Team Statistics
        totalTeams,
        activeTeams,
        inactiveTeams,
        teamsCreatedToday,
        membersAddedToday,
        membersRemovedToday,
        
        // Activity Summary
        totalActivities,
        activitiesToday,
        activitiesThisWeek,
        activitiesThisMonth,
        uniqueActiveUsersToday,
        uniqueActiveUsersThisWeek,
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
        .find({ activityType: EventType.LOGIN })
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
              EventType.LOGIN, 
              EventType.LOGOUT, 
              EventType.PROFILE_UPDATE,
              EventType.USER_CREATED,
              EventType.USER_DELETED,
              EventType.USER_INVITED,
              EventType.USER_ACTIVATED,
              EventType.USER_DEACTIVATED,
              EventType.PASSWORD_RESET,
              EventType.FORGOT_PASSWORD,
              EventType.LOGIN_FAILED
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
        action: (activity as any).activityType as EventType,
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