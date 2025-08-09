import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { EventLog, EventLogDocument } from '../schemas/event-log.schema';
import { EventSeverity, EventAction } from '../../dashboard/interfaces/common';
import { UserActivity, UserActivityDocument, ActivityType } from '../schemas/user-activity.schema';

@Injectable()
export class ActivityLoggerService {
  private readonly logger = new Logger(ActivityLoggerService.name);

  constructor(
    @InjectModel(EventLog.name) private eventLogModel: Model<EventLogDocument>,
    @InjectModel(UserActivity.name) private userActivityModel: Model<UserActivityDocument>,
  ) {}

  // Event Logging Methods
  async logEvent(
    type: EventAction,
    message: string,
    severity: EventSeverity = EventSeverity.LOW,
    userId?: string,
    userEmail?: string,
    userRole?: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ) {
    try {
      const eventLog = new this.eventLogModel({
        type,
        message,
        severity,
        userId,
        userEmail,
        userRole,
        metadata,
        ipAddress,
        userAgent,
        timestamp: new Date(),
      });

      await eventLog.save();
      this.logger.log(`📝 Event logged: ${type} - ${message}`);
    } catch (error) {
      this.logger.error(`❌ Failed to log event: ${error.message}`);
    }
  }

  // User Activity Methods
  async logUserActivity(
    userId: string,
    userEmail: string,
    userRole: string,
    activityType: ActivityType,
    description: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string,
    sessionDuration?: number,
    isSuccessful: boolean = true,
    errorMessage?: string,
  ) {
    try {
      const userActivity = new this.userActivityModel({
        userId,
        userEmail,
        userRole,
        activityType,
        description,
        metadata,
        ipAddress,
        userAgent,
        sessionId,
        sessionDuration,
        activityTime: new Date(),
        isSuccessful,
        errorMessage,
      });

      await userActivity.save();
      this.logger.log(`👤 Activity logged: ${activityType} - ${description}`);
    } catch (error) {
      this.logger.error(`❌ Failed to log user activity: ${error.message}`);
    }
  }

  // Specific logging methods for common activities
  async logUserLogin(userId: string, userEmail: string, userRole: string, ipAddress?: string, userAgent?: string) {
    await Promise.all([
      this.logEvent(
        EventAction.LOGIN,
        `User ${userEmail} logged in successfully`,
        EventSeverity.LOW,
        userId,
        userEmail,
        userRole,
        { loginTime: new Date() },
        ipAddress,
        userAgent,
      ),
      this.logUserActivity(
        userId,
        userEmail,
        userRole,
        ActivityType.LOGIN,
        'User logged in successfully',
        { loginTime: new Date() },
        ipAddress,
        userAgent,
      ),
    ]);
  }

  async logUserLogout(userId: string, userEmail: string, userRole: string, sessionDuration?: number, ipAddress?: string, userAgent?: string) {
    await Promise.all([
      this.logEvent(
        EventAction.LOGOUT,
        `User ${userEmail} logged out`,
        EventSeverity.LOW,
        userId,
        userEmail,
        userRole,
        { logoutTime: new Date(), sessionDuration },
        ipAddress,
        userAgent,
      ),
      this.logUserActivity(
        userId,
        userEmail,
        userRole,
        ActivityType.LOGOUT,
        'User logged out',
        { logoutTime: new Date(), sessionDuration },
        ipAddress,
        userAgent,
        undefined,
        sessionDuration,
      ),
    ]);
  }

  async logDashboardAccess(userId: string, userEmail: string, userRole: string, dashboardType: string, ipAddress?: string, userAgent?: string) {
    await Promise.all([
      this.logEvent(
        EventAction.DASHBOARD_ACCESS,
        `User ${userEmail} accessed ${dashboardType} dashboard`,
        EventSeverity.LOW,
        userId,
        userEmail,
        userRole,
        { dashboardType, accessTime: new Date() },
        ipAddress,
        userAgent,
      ),
      this.logUserActivity(
        userId,
        userEmail,
        userRole,
        ActivityType.DASHBOARD_ACCESS,
        `Accessed ${dashboardType} dashboard`,
        { dashboardType, accessTime: new Date() },
        ipAddress,
        userAgent,
      ),
    ]);
  }

  async logUserInvitation(invitedBy: string, invitedByEmail: string, invitedByRole: string, invitedEmail: string, role: string, ipAddress?: string, userAgent?: string) {
    await this.logEvent(
      EventAction.USER_INVITED,
      `User ${invitedByEmail} invited ${invitedEmail} as ${role}`,
      EventSeverity.MEDIUM,
      invitedBy,
      invitedByEmail,
      invitedByRole,
      { invitedEmail, role, invitationTime: new Date() },
      ipAddress,
      userAgent,
    );
  }

  async logInvitationSuccess(invitedEmail: string, role: string) {
    await this.logEvent(
      EventAction.USER_INVITATION_SUCCESS,
      `Invitation sent successfully to ${invitedEmail} as ${role}`,
      EventSeverity.LOW,
      undefined,
      invitedEmail,
      role,
      { successTime: new Date() },
    );
  }

  async logInvitationFailed(invitedEmail: string, role: string, error: string) {
    await this.logEvent(
      EventAction.USER_INVITATION_FAILED,
      `Failed to send invitation to ${invitedEmail}: ${error}`,
      EventSeverity.HIGH,
      undefined,
      invitedEmail,
      role,
      { error, failureTime: new Date() },
    );
  }

  async logPasswordReset(userId: string, userEmail: string, userRole: string, ipAddress?: string, userAgent?: string) {
    await this.logEvent(
      EventAction.PASSWORD_RESET,
      `Password reset requested for ${userEmail}`,
      EventSeverity.MEDIUM,
      userId,
      userEmail,
      userRole,
      { resetRequestTime: new Date() },
      ipAddress,
      userAgent,
    );
  }

  async logPasswordResetSuccess(userId: string, userEmail: string, userRole: string, ipAddress?: string, userAgent?: string) {
    await Promise.all([
      this.logEvent(
        EventAction.PASSWORD_RESET_SUCCESS,
        `Password reset successful for ${userEmail}`,
        EventSeverity.LOW,
        userId,
        userEmail,
        userRole,
        { resetSuccessTime: new Date() },
        ipAddress,
        userAgent,
      ),
      this.logUserActivity(
        userId,
        userEmail,
        userRole,
        ActivityType.PASSWORD_CHANGE,
        'Password reset completed successfully',
        { resetTime: new Date() },
        ipAddress,
        userAgent,
      ),
    ]);
  }

  async logPasswordResetFailed(userId: string, userEmail: string, userRole: string, error: string, ipAddress?: string, userAgent?: string) {
    await this.logEvent(
      EventAction.PASSWORD_RESET_FAILED,
      `Password reset failed for ${userEmail}: ${error}`,
      EventSeverity.HIGH,
      userId,
      userEmail,
      userRole,
      { error, failureTime: new Date() },
      ipAddress,
      userAgent,
    );
  }

  // Analytics methods for dashboard data
  async getActivityStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalLogins,
      loginsToday,
      loginsThisWeek,
      passwordInvitations,
      pendingInvitations,
      expiredInvitations,
      successfulInvitations,
      failedInvitations,
      averageSessionTime,
    ] = await Promise.all([
      // Total logins
      this.userActivityModel.countDocuments({ activityType: ActivityType.LOGIN }),
      
      // Logins today
      this.userActivityModel.countDocuments({
        activityType: ActivityType.LOGIN,
        activityTime: { $gte: today },
      }),
      
      // Logins this week
      this.userActivityModel.countDocuments({
        activityType: ActivityType.LOGIN,
        activityTime: { $gte: weekAgo },
      }),
      
      // Password reset invitations
      this.eventLogModel.countDocuments({
        type: EventAction.PASSWORD_RESET,
        timestamp: { $gte: monthAgo },
      }),
      
      // Pending invitations (you might need to implement this based on your invitation system)
      this.eventLogModel.countDocuments({
        type: EventAction.USER_INVITED,
        timestamp: { $gte: monthAgo },
      }),
      
      // Expired invitations (you might need to implement this based on your invitation system)
      this.eventLogModel.countDocuments({
        type: EventAction.USER_INVITATION_EXPIRED,
        timestamp: { $gte: monthAgo },
      }),
      
      // Successful invitations
      this.eventLogModel.countDocuments({
        type: EventAction.USER_INVITATION_SUCCESS,
        timestamp: { $gte: monthAgo },
      }),
      
      // Failed invitations
      this.eventLogModel.countDocuments({
        type: EventAction.USER_INVITATION_FAILED,
        timestamp: { $gte: monthAgo },
      }),
      
      // Average session time (in minutes)
      this.userActivityModel.aggregate([
        { $match: { activityType: ActivityType.LOGOUT, sessionDuration: { $exists: true, $ne: null } } },
        { $group: { _id: null, avgSessionTime: { $avg: '$sessionDuration' } } },
      ]).then(result => result[0]?.avgSessionTime || 0),
    ]);

    return {
      totalLogins,
      loginsToday,
      loginsThisWeek,
      passwordInvitations,
      pendingInvitations,
      expiredInvitations,
      successfulInvitations,
      failedInvitations,
      averageSessionTime: Math.round(averageSessionTime),
    };
  }

  async getTrends() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      totalUsersToday,
      totalUsersYesterday,
      managersToday,
      managersYesterday,
      activeUsersToday,
      activeUsersYesterday,
      loginsToday,
      loginsYesterday,
    ] = await Promise.all([
      // Total users today vs yesterday
      this.userActivityModel.distinct('userId', { activityTime: { $gte: today } }),
      this.userActivityModel.distinct('userId', { activityTime: { $gte: yesterday, $lt: today } }),
      
      // Managers today vs yesterday
      this.userActivityModel.distinct('userId', { 
        activityTime: { $gte: today },
        userRole: 'MANAGER',
      }),
      this.userActivityModel.distinct('userId', { 
        activityTime: { $gte: yesterday, $lt: today },
        userRole: 'MANAGER',
      }),
      
      // Active users today vs yesterday
      this.userActivityModel.distinct('userId', { 
        activityTime: { $gte: today },
        activityType: ActivityType.LOGIN,
      }),
      this.userActivityModel.distinct('userId', { 
        activityTime: { $gte: yesterday, $lt: today },
        activityType: ActivityType.LOGIN,
      }),
      
      // Logins today vs yesterday
      this.userActivityModel.countDocuments({
        activityType: ActivityType.LOGIN,
        activityTime: { $gte: today },
      }),
      this.userActivityModel.countDocuments({
        activityType: ActivityType.LOGIN,
        activityTime: { $gte: yesterday, $lt: today },
      }),
    ]);

    // Calculate trends
    const calculateTrend = (current: number, previous: number) => {
      if (previous === 0) return { value: current > 0 ? 100 : 0, isPositive: current > 0 };
      const change = ((current - previous) / previous) * 100;
      return { value: Math.round(change * 10) / 10, isPositive: change >= 0 };
    };

    return {
      totalUsers: calculateTrend(totalUsersToday.length, totalUsersYesterday.length),
      managers: calculateTrend(managersToday.length, managersYesterday.length),
      activeUsers: calculateTrend(activeUsersToday.length, activeUsersYesterday.length),
      todayLogins: calculateTrend(loginsToday, loginsYesterday),
    };
  }
}
