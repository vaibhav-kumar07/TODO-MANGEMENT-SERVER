import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument, TaskStatus, TaskPriority } from './schemas/task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto,  } from './dto/query-tasks.dto';
import { User, UserRole } from '../users/schemas/user.schema';
import { Logger } from '@nestjs/common';
import { DashboardGateway } from '../websocket/websocket.gateway';
import { TaskAction } from '../dashboard/interfaces/common'; 

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    private dashboardGateway: DashboardGateway,
  ) {}

  async createTask(createTaskDto: CreateTaskDto, userId: string): Promise<Task> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const taskData: any = {
      ...createTaskDto,
      createdBy: new Types.ObjectId(userId),
      assignedBy: new Types.ObjectId(userId),
    };

    // Handle personal tasks
    if (createTaskDto.isPersonal) {
      if (user.role !== UserRole.MEMBER) {
        throw new ForbiddenException('Only members can create personal tasks');
      }
      taskData.assignedTo = new Types.ObjectId(userId);
      taskData.isPersonal = true;
    } else {
      // Handle project tasks
      if (user.role !== UserRole.MANAGER) {
        throw new ForbiddenException('Only managers can create project tasks');
      }

      if (!createTaskDto.assignedTo) {
        throw new BadRequestException(' tasks must be assigned to a member');
      }

      // Verify assigned user is a member
      const assignedUser = await this.userModel.findById(createTaskDto.assignedTo);
      if (!assignedUser || assignedUser.role !== UserRole.MEMBER) {
        throw new BadRequestException('Can only assign tasks to members');
      }

      taskData.assignedTo = new Types.ObjectId(createTaskDto.assignedTo);
      taskData.isPersonal = false;
    }

    if (createTaskDto.dueDate) {
      taskData.dueDate = new Date(createTaskDto.dueDate);
    }

    
    const task = new this.taskModel(taskData);
    const savedTask = await task.save();
    
    // Populate the saved task with user details
    const populatedTask = await this.taskModel
      .findById(savedTask._id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .exec();
    
    if (!populatedTask) {
      throw new NotFoundException('Failed to create task');
    }
    
    // Emit manager-scoped task counter for project tasks only
    if (!populatedTask.isPersonal) {
      // Use reliable manager identifier. Since this action is performed by the manager,
      // we can safely use userId here instead of relying on a populated document.
      const managerId = userId;
      await this.dashboardGateway.emitTaskEvent(managerId, TaskAction.TASK_CREATED, true);
      if (populatedTask.priority === TaskPriority.HIGH) {
        await this.dashboardGateway.emitTaskEvent(managerId, TaskAction.TASK_HIGH_PRIORITY, true);
      }
      if (populatedTask.dueDate) {
        await this.dashboardGateway.emitTaskEvent(managerId, TaskAction.TASK_DUE_DATE, true);
      }
      // Initial status counters
      if (populatedTask.status === TaskStatus.COMPLETED) {
        await this.dashboardGateway.emitTaskEvent(managerId, TaskAction.TASK_COMPLETED, true);
      }
      if (populatedTask.status === TaskStatus.IN_PROGRESS) {
        await this.dashboardGateway.emitTaskEvent(managerId, TaskAction.TASK_IN_PROGRESS, true);
      }
    }

    return populatedTask;
  }

  async findAll(queryDto: QueryTasksDto, userId: string): Promise<{ tasks: Task[]; pagination: any }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`🔍 Finding tasks for user: ${userId} (${user.role})`);

    const filter: any = {};
    if (user.role === UserRole.MEMBER) {
      filter.assignedTo = new Types.ObjectId(userId);
    }
    if (user.role === UserRole.MANAGER) {
      filter.createdBy = new Types.ObjectId(userId);
    }

    // Apply additional filters
    if (queryDto.status) {
      filter.status = queryDto.status;
      this.logger.log(`📊 Status filter: ${queryDto.status}`);
    }
    if (queryDto.priority) {
      filter.priority = queryDto.priority;
      this.logger.log(`📊 Priority filter: ${queryDto.priority}`);
    }
    // Only allow assignedTo filter for non-members (managers/admins)
    if (queryDto.assignedTo && user.role !== UserRole.MEMBER) {
      filter.assignedTo = new Types.ObjectId(queryDto.assignedTo);
      this.logger.log(`📊 AssignedTo filter: ${queryDto.assignedTo}`);
    }

    // Apply due date filters
    if (queryDto.dueDateFrom || queryDto.dueDateTo) {
      filter.dueDate = {};
      
      if (queryDto.dueDateFrom) {
        filter.dueDate.$gte = new Date(queryDto.dueDateFrom);
        this.logger.log(`📅 Due date from: ${queryDto.dueDateFrom}`);
      }
      
      if (queryDto.dueDateTo) {
        filter.dueDate.$lte = new Date(queryDto.dueDateTo);
        this.logger.log(`📅 Due date to: ${queryDto.dueDateTo}`);
      }
    }

    // Apply overdue filter
    if (queryDto.overdue) {
      filter.$and = [
        { dueDate: { $lt: new Date() } },
        { status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] } }
      ];
      this.logger.log(`📊 Overdue filter applied`);
    }

    // Apply search filter
    if (queryDto.search) {
      filter.$or = [
        { title: { $regex: queryDto.search, $options: 'i' } },
        { description: { $regex: queryDto.search, $options: 'i' } },
      ];
      this.logger.log(`🔍 Search filter: ${queryDto.search}`);
    }

    this.logger.log(`🎯 Final filter: ${JSON.stringify(filter)}`);

    // Pagination
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await this.taskModel.countDocuments(filter);
    this.logger.log(`📊 Total tasks found: ${total}`);

    // Get tasks with pagination and sorting
    const tasks = await this.taskModel
      .find(filter)
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .skip(skip)
      .limit(limit)
      .exec();

    this.logger.log(`✅ Returning ${tasks.length} tasks for user ${userId}`);

    return {
      tasks,
      pagination: {
        page,
        limit,
        total,
      },
    };
  }

 
  async findOne(id: string, userId: string): Promise<Task> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const task = await this.taskModel
      .findById(id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .exec();

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Check permissions
    if (task.isPersonal) {
      if (task.createdBy.toString() !== userId.toString()) {
        throw new ForbiddenException('Cannot access personal task of another user');
      }
    } else {
      // Project task permissions
      if (user.role === UserRole.MEMBER) {
        if (task.assignedTo.toString() !== userId.toString()) {
          throw new ForbiddenException('Cannot access project task not assigned to you');
        }
      } 
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string): Promise<Task> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const task = await this.taskModel.findById(id);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Check permissions
    if (task.isPersonal) {
      if (task.createdBy.toString() !== userId.toString()) {
        throw new ForbiddenException('Cannot modify personal task of another user');
      }
    } else {
      // Project task permissions
      if (user.role === UserRole.MEMBER) {
        // Members can only update status of tasks assigned to them
        if (task.assignedTo.toString() !== userId.toString() && task.createdBy.toString() !== userId.toString()) {
          throw new ForbiddenException('Cannot modify project task not assigned to you');
        }
      } else if (user.role === UserRole.MANAGER) {
        if (task.createdBy.toString() !== userId.toString()) {
          throw new ForbiddenException('Can only modify tasks you created');
        }
      }
    }

    // Handle status transitions
    if (updateTaskDto.status && updateTaskDto.status !== task.status) {
      this.validateStatusTransition(task.status, updateTaskDto.status);
    }

    // Handle assignment changes (only managers can reassign)
    if (updateTaskDto.assignedTo && !task.isPersonal && user.role === UserRole.MANAGER) {
      const assignedUser = await this.userModel.findById(updateTaskDto.assignedTo);
      if (!assignedUser || assignedUser.role !== UserRole.MEMBER) {
        throw new BadRequestException('Can only assign tasks to members');
      }
    }

    const updateData: any = { ...updateTaskDto };
    if (updateTaskDto.dueDate) {
      updateData.dueDate = new Date(updateTaskDto.dueDate);
    }
    if (updateTaskDto.assignedTo) {
      updateData.assignedTo = new Types.ObjectId(updateTaskDto.assignedTo);
    }

    const previousDueDate = task.dueDate;
    const previousStatus = task.status;

    const updatedTask = await this.taskModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .exec();

    if (!updatedTask) {
      throw new NotFoundException('Task not found');
    }

    // Emit manager-scoped task counters for project tasks only
    if (!updatedTask.isPersonal) {
      // Ensure we extract the correct manager id regardless of population state
      const managerId = ((updatedTask as any).createdBy?._id?.toString?.())
        || ((updatedTask as any).createdBy?.toString?.())
        || '';
     
      // Due date set/cleared
      if (updateTaskDto.dueDate !== undefined) {
        const hadDueDate = !!previousDueDate;
        const hasDueDateNow = !!updateTaskDto.dueDate;
        if (!hadDueDate && hasDueDateNow) {
          await this.dashboardGateway.emitTaskEvent(managerId, TaskAction.TASK_DUE_DATE, true);
        }
        if (hadDueDate && !hasDueDateNow) {
          await this.dashboardGateway.emitTaskEvent(managerId, TaskAction.TASK_DUE_DATE, false);
        }
      }

      // Status transitions for counters (COMPLETED / IN_PROGRESS)
      if (updateTaskDto.status && updateTaskDto.status !== previousStatus) {
        if (updateTaskDto.status === TaskStatus.COMPLETED) {
          console.log(`🔄 Task ${id} completed by manager ${managerId}`);
          await this.dashboardGateway.emitTaskEvent(managerId, TaskAction.TASK_COMPLETED, true);
          // Leaving IN_PROGRESS → decrement if coming from that
          if (previousStatus === TaskStatus.IN_PROGRESS) {
            await this.dashboardGateway.emitTaskEvent(managerId, TaskAction.TASK_IN_PROGRESS, false);
          }
        } else if (previousStatus === TaskStatus.COMPLETED) {
          // No longer completed → decrement completed
          await this.dashboardGateway.emitTaskEvent(managerId, TaskAction.TASK_COMPLETED, false);
        }

        if (updateTaskDto.status === TaskStatus.IN_PROGRESS) {
          await this.dashboardGateway.emitTaskEvent(managerId, TaskAction.TASK_IN_PROGRESS, true);
        } else if (previousStatus === TaskStatus.IN_PROGRESS) {
          await this.dashboardGateway.emitTaskEvent(managerId, TaskAction.TASK_IN_PROGRESS, false);
        }
      }
    }

    return updatedTask as Task;
  }

  async remove(id: string, userId: string): Promise<void> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const task = await this.taskModel.findById(id);
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // Check permissions
    if (task.isPersonal) {
      if (task.createdBy.toString() !== userId.toString()) {
        throw new ForbiddenException('Cannot delete personal task of another user');
      }
    } else {
      // Project task permissions
      if (user.role === UserRole.MEMBER) {
        throw new ForbiddenException('Members cannot delete project tasks');
      } else if (user.role === UserRole.MANAGER) {
        if (task.createdBy.toString() !== userId.toString()) {
          throw new ForbiddenException('Can only delete tasks you created');
        }
      }
    }

    await this.taskModel.findByIdAndDelete(id);
  }

  async getMyTaskStats(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get all tasks assigned to this member
    const allTasks = await this.taskModel.find({ assignedTo: new Types.ObjectId(userId) });
    
    const stats = {
      total: allTasks.length,
      todo: allTasks.filter(task => task.status === TaskStatus.TODO).length,
      inProgress: allTasks.filter(task => task.status === TaskStatus.IN_PROGRESS).length,
      review: allTasks.filter(task => task.status === TaskStatus.REVIEW).length,
      completed: allTasks.filter(task => task.status === TaskStatus.COMPLETED).length,
      cancelled: allTasks.filter(task => task.status === TaskStatus.CANCELLED).length,
      overdue: allTasks.filter(task => {
        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
        const isActive = ![TaskStatus.COMPLETED, TaskStatus.CANCELLED].includes(task.status);
        return isOverdue && isActive;
      }).length,
      dueSoon: allTasks.filter(task => {
        const dueDate = new Date(task.dueDate);
        const now = new Date();
        const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const isActive = ![TaskStatus.COMPLETED, TaskStatus.CANCELLED].includes(task.status);
        return task.dueDate && dueDate <= sevenDaysFromNow && dueDate > now && isActive;
      }).length,
      completionRate: allTasks.length > 0 
        ? Math.round((allTasks.filter(task => task.status === TaskStatus.COMPLETED).length / allTasks.length) * 100)
        : 0
    };

    return stats;
  }

  async deleteTaskAsManager(taskId: string, userId: string): Promise<any> {
    try {
      this.logger.log(`🗑️ Manager attempting to delete task: ${taskId} by user: ${userId}`);

      // Validate task ID
      if (!Types.ObjectId.isValid(taskId)) {
        return {
          success: false,
          error: 'Invalid task ID',
          message: 'The provided task ID is not valid'
        };
      }

      // Get the current user
      const user = await this.userModel.findById(userId);
      if (!user) {
        return {
          success: false,
          error: 'User not found',
          message: 'The specified user does not exist'
        };
      }

      // Check if user is manager or admin
      if (user.role !== UserRole.MANAGER && user.role !== UserRole.ADMIN) {
        return {
          success: false,
          error: 'Insufficient permissions',
          message: 'Only managers and administrators can delete tasks'
        };
      }

      // Find the task
      const task = await this.taskModel.findById(taskId);
      if (!task) {
        return {
          success: false,
          error: 'Task not found',
          message: 'The specified task does not exist'
        };
      }

      this.logger.log(`🗑️ Task found: ${task.title} (created by: ${task.createdBy})`);

      // Additional validation: Managers can only delete tasks they created
      if (user.role === UserRole.MANAGER && task.createdBy.toString() !== userId) {
        return {
          success: false,
          error: 'Access denied',
          message: 'Managers can only delete tasks they created'
        };
      }

      // Delete the task
      await this.taskModel.findByIdAndDelete(taskId);

      this.logger.log(`✅ Task deleted successfully: ${taskId}`);

      return {
        success: true,
        message: 'Task deleted successfully'
      };

    } catch (error) {
      this.logger.error(`❌ Error deleting task: ${error.message}`);
      return {
        success: false,
        error: 'Internal server error',
        message: error.message
      };
    }
  }

  private validateStatusTransition(currentStatus: TaskStatus, newStatus: TaskStatus): void {
    this.logger.log(`🔄 Validating status transition: ${currentStatus} → ${newStatus}`);
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.IN_PROGRESS]: [TaskStatus.REVIEW, TaskStatus.CANCELLED, TaskStatus.COMPLETED],
      [TaskStatus.REVIEW]: [TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.COMPLETED]: [TaskStatus.IN_PROGRESS, TaskStatus.REVIEW], // Allow reopening completed tasks
      [TaskStatus.CANCELLED]: [TaskStatus.TODO, TaskStatus.IN_PROGRESS], // Allow reactivating cancelled tasks
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
        `Valid transitions from ${currentStatus}: ${validTransitions[currentStatus].join(', ')}`
      );
    }
  }
} 