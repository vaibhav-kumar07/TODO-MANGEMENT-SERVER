import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task, TaskDocument, TaskStatus, TaskPriority } from '../tasks/schemas/task.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { DashboardGateway } from '../websocket/websocket.gateway';
import { ManagerStats, ManagerActivityData, TaskEvent, TaskEventType } from './interfaces/manager-dashboard';

@Injectable()
export class ManagerDashboardService {
  private readonly logger = new Logger(ManagerDashboardService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private dashboardGateway: DashboardGateway,
  ) {}

  async getManagerStats(managerId: string): Promise<{ success: boolean; data?: ManagerStats; error?: string; message: string }> {
    try {
      this.logger.log(`📊 Manager stats requested for manager: ${managerId}`);

      // Get current date range for today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get members who have tasks assigned by this manager
      const membersWithTasks = await this.taskModel.distinct('assignedTo', {
        // assignedBy: managerId
      });

      // Task Statistics
      const totalTasks = await this.taskModel.countDocuments();

      const tasksCreatedToday = await this.taskModel.countDocuments({
        // assignedBy: managerId,
        createdAt: { $gte: today }
      });

      const pendingTasks = await this.taskModel.countDocuments({
        // assignedBy: managerId,
        status: TaskStatus.TODO
      });

      const completedTasks = await this.taskModel.countDocuments({
        // assignedBy: managerId,
        status: TaskStatus.COMPLETED
      });

      const overdueTasks = await this.taskModel.countDocuments({
        // assignedBy: managerId,
        dueDate: { $lt: new Date() },
        status: { $ne: TaskStatus.COMPLETED }
      });

      const highPriorityTasks = await this.taskModel.countDocuments({
        // assignedBy: managerId,
        priority: TaskPriority.HIGH,
        status: { $ne: TaskStatus.COMPLETED }
      });

      const dueTodayTasks = await this.taskModel.countDocuments({
        // assignedBy: managerId,
        dueDate: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
        },
        status: { $ne: TaskStatus.COMPLETED }
      });

      // Member Statistics
      const totalMembers = membersWithTasks.length;

      const membersAddedToday = await this.taskModel.countDocuments({
        // assignedBy: managerId,
        createdAt: { $gte: today }
      });

      const membersWithActiveTasks = await this.taskModel.distinct('assignedTo', {
        // assignedBy: managerId,
        status: { $ne: TaskStatus.COMPLETED }
      }).then(ids => ids.length);

      const membersWithoutTasks = totalMembers - membersWithActiveTasks;

      // Today's Activity Summary
      const todaysSummary = {
        tasksCreated: tasksCreatedToday,
        tasksCompleted: await this.taskModel.countDocuments({
          // assignedBy: managerId,
          completedAt: { $gte: today }
        }),
        tasksAssigned: await this.taskModel.countDocuments({
          // assignedBy: managerId,
          lastAssignedAt: { $gte: today }
        }),
        tasksUpdated: await this.taskModel.countDocuments({
          // assignedBy: managerId,
          updatedAt: { $gte: today }
        }),
        tasksDeleted: await this.taskModel.countDocuments({
          // assignedBy: managerId,
          deletedAt: { $gte: today }
        }),
        statusChanges: await this.taskModel.countDocuments({
          // assignedBy: managerId,
          'statusHistory.timestamp': { $gte: today }
        }),
        priorityChanges: await this.taskModel.countDocuments({
          assignedBy: managerId,
          'priorityHistory.timestamp': { $gte: today }
        }),
        dueDateChanges: await this.taskModel.countDocuments({
          assignedBy: managerId,
          'dueDateHistory.timestamp': { $gte: today }
        })
      };

      const stats: ManagerStats = {
        totalTasks,
        tasksCreatedToday,
        pendingTasks,
        completedTasks,
        overdueTasks,
        highPriorityTasks,
        dueTodayTasks,
        totalMembers,
        membersAddedToday,
        membersWithTasks: membersWithActiveTasks,
        membersWithoutTasks,
        todaysSummary
      };

      this.logger.log(`📈 Manager stats prepared successfully for manager: ${managerId}`);
      return {
        success: true,
        data: stats,
        message: 'Manager statistics retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`❌ Error getting manager stats: ${error.message}`);
      return {
        success: false,
        error: 'Failed to retrieve manager statistics',
        message: error.message,
      };
    }
  }

  async getManagerActivity(managerId: string): Promise<{ success: boolean; data?: ManagerActivityData; error?: string; message: string }> {
    try {
      this.logger.log(`📊 Manager activity requested for manager: ${managerId}`);

      // Get current date range for today's stats
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get recent task events from task history
      const recentTasks = await this.taskModel
        .find({
          assignedBy: managerId,
          updatedAt: { $exists: true }
        })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('assignedTo', 'email firstName lastName')
        .populate('lastUpdatedBy', 'email firstName lastName role')
        .lean();

      const recentTaskEvents: TaskEvent[] = recentTasks
        .filter(task => task.lastUpdatedBy) // Only include tasks with lastUpdatedBy
        .map(task => ({
          taskId: task._id.toString(),
          taskTitle: task.title,
          assignedTo: task.assignedTo ? {
            userId: (task.assignedTo as any)._id.toString(),
            userName: `${(task.assignedTo as any).firstName} ${(task.assignedTo as any).lastName}`,
            userEmail: (task.assignedTo as any).email
          } : undefined,
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
          eventType: TaskEventType.TASK_UPDATED,
          timestamp: task.updatedAt,
          changes: {},
          performedBy: {
            userId: (task.lastUpdatedBy as any)._id.toString(),
            userName: `${(task.lastUpdatedBy as any).firstName} ${(task.lastUpdatedBy as any).lastName}`,
            role: (task.lastUpdatedBy as any).role
          }
        }));

      // Get today's activity summary by event type
      const todaysSummary = {
        [TaskEventType.TASK_CREATED]: await this.taskModel.countDocuments({
          assignedBy: managerId,
          createdAt: { $gte: today }
        }),
        [TaskEventType.TASK_UPDATED]: await this.taskModel.countDocuments({
          assignedBy: managerId,
          updatedAt: { $gte: today }
        }),
        [TaskEventType.TASK_DELETED]: await this.taskModel.countDocuments({
          assignedBy: managerId,
          deletedAt: { $gte: today }
        }),
        [TaskEventType.TASK_ASSIGNED]: await this.taskModel.countDocuments({
          assignedBy: managerId,
          lastAssignedAt: { $gte: today }
        }),
        [TaskEventType.TASK_COMPLETED]: await this.taskModel.countDocuments({
          assignedBy: managerId,
          completedAt: { $gte: today }
        }),
        [TaskEventType.TASK_STATUS_CHANGED]: await this.taskModel.countDocuments({
          assignedBy: managerId,
          'statusHistory.timestamp': { $gte: today }
        }),
        [TaskEventType.TASK_PRIORITY_CHANGED]: await this.taskModel.countDocuments({
          assignedBy: managerId,
          'priorityHistory.timestamp': { $gte: today }
        }),
        [TaskEventType.TASK_DUE_DATE_CHANGED]: await this.taskModel.countDocuments({
          assignedBy: managerId,
          'dueDateHistory.timestamp': { $gte: today }
        })
      };

      const activityData: ManagerActivityData = {
        recentTaskEvents,
        todaysSummary
      };

      this.logger.log(`📈 Manager activity prepared successfully for manager: ${managerId}`);
      return {
        success: true,
        data: activityData,
        message: 'Manager activity retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`❌ Error getting manager activity: ${error.message}`);
      return {
        success: false,
        error: 'Failed to retrieve manager activity',
        message: error.message,
      };
    }
  }

  // Event emission methods for each task event type
  async emitTaskEvent(eventType: TaskEventType, taskId: string, taskData: any, managerId: string) {
    try {
      const eventPayload = {
        taskId,
        ...taskData,
        eventType,
        timestamp: Date.now()
      };

      // Emit to the manager's room
      this.dashboardGateway.server.to(`manager-${managerId}`).emit(eventType, eventPayload);

      this.logger.log(`📤 Emitted ${eventType} event for task: ${taskId}`);
    } catch (error) {
      this.logger.error(`❌ Failed to emit ${eventType} event: ${error.message}`);
    }
  }


}