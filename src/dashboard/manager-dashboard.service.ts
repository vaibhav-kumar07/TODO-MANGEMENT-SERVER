import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task, TaskDocument, TaskStatus } from '../tasks/schemas/task.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { DashboardGateway } from '../websocket/websocket.gateway';
import { ManagerDashboardStats, ManagerActivityData, TaskEvent, TaskAction } from './interfaces/common';

@Injectable()
export class ManagerDashboardService {
  private readonly logger = new Logger(ManagerDashboardService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private dashboardGateway: DashboardGateway,
  ) {}

  async getManagerStats(managerId: string): Promise<{ success: boolean; data?: ManagerDashboardStats; error?: string; message: string }> {
    try {
      this.logger.log(`📊 Manager stats requested for manager: ${managerId}`);

      // Task Statistics (scoped to manager)
      const [totalTasks, overdueTasks, completedTasks, inProgressTasks] = await Promise.all([
        this.taskModel.countDocuments({ createdBy: managerId }),
        this.taskModel.countDocuments({
          createdBy: managerId,
          dueDate: { $lt: new Date() },
          status: { $ne: TaskStatus.COMPLETED },
        }),
        this.taskModel.countDocuments({ createdBy: managerId, status: TaskStatus.COMPLETED }),
        this.taskModel.countDocuments({ createdBy: managerId, status: TaskStatus.IN_PROGRESS }),
      ]);

      const stats: ManagerDashboardStats = {
        totalTasks,
        overdueTasks,
        completedTasks,
        inProgressTasks,
        info:{
            managerId,
        }

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

      // Get recent task events from task history - get all tasks without manager filtering
      const recentTasks = await this.taskModel
        .find({
          updatedAt: { $exists: true }
        })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate('assignedTo', 'email firstName lastName')
        .populate('lastUpdatedBy', 'email firstName lastName role')
        .populate('createdBy', 'email firstName lastName role')
        .lean();

      const recentTaskEvents: TaskEvent[] = recentTasks
        .filter(task => task.lastUpdatedBy || task.createdBy) // Only include tasks with a performer
        .map(task => {
          // Determine who performed the action
          const performedBy = task.lastUpdatedBy || task.createdBy;
          
          // Determine event type based on what changed
          let eventType = TaskAction.TASK_CREATED;
          if (task.createdAt && task.updatedAt && 
              Math.abs(task.createdAt.getTime() - task.updatedAt.getTime()) < 1000) {
            eventType = TaskAction.TASK_CREATED;
          }

          return {
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
            eventType,
            timestamp: task.updatedAt || task.createdAt,
            changes: {},
            performedBy: {
              userId: (performedBy as any)._id.toString(),
              userName: `${(performedBy as any).firstName} ${(performedBy as any).lastName}`,
              role: (performedBy as any).role
            }
          };
        });

    

      const activityData: ManagerActivityData = {
        recentTaskEvents,
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

  // Emit compact task counters to manager room
  async emitTaskCounter(managerId: string, action: TaskAction, isIncrement: boolean) {
    await this.dashboardGateway.emitTaskEvent(managerId, action, isIncrement);
  }


}