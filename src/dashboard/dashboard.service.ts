import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from '../users/schemas/user.schema';
import { Task, TaskDocument, TaskStatus } from '../tasks/schemas/task.schema';
import { DashboardGateway } from '../websocket/websocket.gateway';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    private dashboardGateway: DashboardGateway,
  ) {}

  // Admin Dashboard Data
  async getAdminDashboardData() {
    try {
      const [
        totalUsers,
        activeUsers,
        inactiveUsers,
        usersByRole,
        totalTasks,
        tasksByStatus,
        recentActivity,
      ] = await Promise.all([
        this.userModel.countDocuments(),
        this.userModel.countDocuments({ isActive: true }),
        this.userModel.countDocuments({ isActive: false }),
        this.getUsersByRole(),
        this.taskModel.countDocuments(),
        this.getTasksByStatus(),
        this.getRecentActivity(),
      ]);

      const data = {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          byRole: usersByRole,
        },
        tasks: {
          total: totalTasks,
          byStatus: tasksByStatus,
        },
        recentActivity,
        lastUpdated: new Date().toISOString(),
      };

      // Emit to admin dashboard subscribers
      await this.dashboardGateway.emitDashboardUpdate(UserRole.ADMIN, 'admin', data);

      return {
        success: true,
        data,
        message: 'Admin dashboard data retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`❌ Error getting admin dashboard data: ${error.message}`);
      return {
        success: false,
        error: 'Failed to retrieve admin dashboard data',
        message: error.message,
      };
    }
  }

  // Manager Dashboard Data
  async getManagerDashboardData(managerId: string) {
    try {
      const [
        totalMembers,
        activeMembers,
        inactiveMembers,
        tasksCreatedByManager,
        tasksByStatus,
        memberActivity,
      ] = await Promise.all([
        this.userModel.countDocuments({ role: UserRole.MEMBER }),
        this.userModel.countDocuments({ role: UserRole.MEMBER, isActive: true }),
        this.userModel.countDocuments({ role: UserRole.MEMBER, isActive: false }),
        this.taskModel.countDocuments({ createdBy: managerId }),
        this.getTasksByStatusForManager(managerId),
        this.getMemberActivity(),
      ]);

      const data = {
        members: {
          total: totalMembers,
          active: activeMembers,
          inactive: inactiveMembers,
        },
        tasks: {
          createdByManager: tasksCreatedByManager,
          byStatus: tasksByStatus,
        },
        memberActivity,
        lastUpdated: new Date().toISOString(),
      };

      // Emit to manager dashboard subscribers
      await this.dashboardGateway.emitDashboardUpdate(UserRole.MANAGER, 'manager', data);

      return {
        success: true,
        data,
        message: 'Manager dashboard data retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`❌ Error getting manager dashboard data: ${error.message}`);
      return {
        success: false,
        error: 'Failed to retrieve manager dashboard data',
        message: error.message,
      };
    }
  }

  // Member Dashboard Data
  async getMemberDashboardData(memberId: string) {
    try {
      const [
        assignedTasks,
        tasksByStatus,
        personalStats,
        recentActivity,
      ] = await Promise.all([
        this.taskModel.countDocuments({ assignedTo: memberId }),
        this.getTasksByStatusForMember(memberId),
        this.getPersonalStats(memberId),
        this.getPersonalActivity(memberId),
      ]);

      const data = {
        tasks: {
          assigned: assignedTasks,
          byStatus: tasksByStatus,
        },
        personalStats,
        recentActivity,
        lastUpdated: new Date().toISOString(),
      };

      // Emit to member dashboard subscribers
      await this.dashboardGateway.emitDashboardUpdate(UserRole.MEMBER, 'member', data);

      return {
        success: true,
        data,
        message: 'Member dashboard data retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`❌ Error getting member dashboard data: ${error.message}`);
      return {
        success: false,
        error: 'Failed to retrieve member dashboard data',
        message: error.message,
      };
    }
  }

  // Helper methods
  private async getUsersByRole() {
    const result = await this.userModel.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    const usersByRole = {};
    result.forEach(item => {
      usersByRole[item._id] = item.count;
    });

    return usersByRole;
  }

  private async getTasksByStatus() {
    const result = await this.taskModel.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const tasksByStatus = {};
    result.forEach(item => {
      tasksByStatus[item._id] = item.count;
    });

    return tasksByStatus;
  }

  private async getTasksByStatusForManager(managerId: string) {
    const result = await this.taskModel.aggregate([
      {
        $match: { createdBy: managerId },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const tasksByStatus = {};
    result.forEach(item => {
      tasksByStatus[item._id] = item.count;
    });

    return tasksByStatus;
  }

  private async getTasksByStatusForMember(memberId: string) {
    const result = await this.taskModel.aggregate([
      {
        $match: { assignedTo: memberId },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const tasksByStatus = {};
    result.forEach(item => {
      tasksByStatus[item._id] = item.count;
    });

    return tasksByStatus;
  }

  private async getPersonalStats(memberId: string) {
    const [totalTasks, completedTasks, overdueTasks] = await Promise.all([
      this.taskModel.countDocuments({ assignedTo: memberId }),
      this.taskModel.countDocuments({ 
        assignedTo: memberId, 
        status: { $in: [TaskStatus.DONE, TaskStatus.COMPLETED] } 
      }),
      this.taskModel.countDocuments({ 
        assignedTo: memberId, 
        dueDate: { $lt: new Date() },
        status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] }
      }),
    ]);

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      completionRate: Math.round(completionRate * 100) / 100,
    };
  }

  private async getRecentActivity() {
    const recentTasks = await this.taskModel
      .find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .populate('assignedTo', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email');

    const recentUsers = await this.userModel
      .find()
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('firstName lastName email role isActive updatedAt');

    return {
      tasks: recentTasks,
      users: recentUsers,
    };
  }

  private async getMemberActivity() {
    const recentMembers = await this.userModel
      .find({ role: UserRole.MEMBER })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('firstName lastName email isActive updatedAt');

    return {
      members: recentMembers,
    };
  }

  private async getPersonalActivity(memberId: string) {
    const recentTasks = await this.taskModel
      .find({ assignedTo: memberId })
      .sort({ updatedAt: -1 })
      .limit(10);

    return {
      tasks: recentTasks,
    };
  }

  // Real-time event handlers
  async onTaskCreated(task: any) {
    await this.dashboardGateway.emitTaskUpdate(task._id, {
      type: 'created',
      task,
    });
  }

  async onTaskUpdated(task: any) {
    await this.dashboardGateway.emitTaskUpdate(task._id, {
      type: 'updated',
      task,
    });
  }

  async onUserStatusChanged(user: any) {
    await this.dashboardGateway.emitUserStatusChange(user._id, {
      type: 'status-changed',
      user,
    });
  }

  async onUserActivity(userId: string, activity: any) {
    await this.dashboardGateway.emitUserActivity(userId, activity);
  }

  async onSystemAlert(alert: any, targetRoles: UserRole[] = []) {
    await this.dashboardGateway.emitSystemAlert(alert, targetRoles);
  }
} 