import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument, TaskStatus } from './schemas/task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto,  } from './dto/query-tasks.dto';
import { User, UserRole } from '../users/schemas/user.schema';
import { Logger } from '@nestjs/common';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    @InjectModel(Task.name) private taskModel: Model<TaskDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
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
    
    return populatedTask;
  }

  async findAll(queryDto: QueryTasksDto, userId: string): Promise<{ tasks: Task[]; pagination: any }> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const filter: any = {};

    // Apply additional filters
    if (queryDto.status) {
      filter.status = queryDto.status;
    }
    if (queryDto.priority) {
      filter.priority = queryDto.priority;
    }
    if (queryDto.assignedTo) {
      filter.assignedTo = new Types.ObjectId(queryDto.assignedTo);
    }
    if (queryDto.isPersonal !== undefined) {
      filter.isPersonal = queryDto.isPersonal;
    }

    // Apply due date filters
    if (queryDto.dueDateFrom || queryDto.dueDateTo || queryDto.overdue) {
      filter.dueDate = {};
      
      if (queryDto.dueDateFrom) {
        filter.dueDate.$gte = new Date(queryDto.dueDateFrom);
      }
      
      if (queryDto.dueDateTo) {
        filter.dueDate.$lte = new Date(queryDto.dueDateTo);
      }
      
      if (queryDto.overdue) {
        // Overdue tasks: due date is in the past and status is not COMPLETED or CANCELLED
        filter.$and = [
          { dueDate: { $lt: new Date() } },
          { status: { $nin: [TaskStatus.COMPLETED, TaskStatus.CANCELLED] } }
        ];
      }
    }

    // Apply search filter
    if (queryDto.search) {
      filter.$or = [
        { title: { $regex: queryDto.search, $options: 'i' } },
        { description: { $regex: queryDto.search, $options: 'i' } },
      ];
    }

    // Pagination
    const page = queryDto.page || 1;
    const limit = queryDto.limit || 10;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const total = await this.taskModel.countDocuments(filter);

    // Get tasks with pagination and sorting
    const tasks = await this.taskModel
      .find(filter)
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .skip(skip)
      .limit(limit)
      .exec();

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
        // Members can only update status, not other fields
        const allowedFields = ['status'];
        const updateFields = Object.keys(updateTaskDto);
        const hasInvalidFields = updateFields.some(field => !allowedFields.includes(field));
        if (hasInvalidFields) {
          throw new ForbiddenException('Members can only update task status');
        }
      } else if (user.role === UserRole.MANAGER) {
        if (task.createdBy.toString() !== userId.toString()) {
          throw new ForbiddenException('Can only modify tasks you created');
        }
      }
    }

    // Handle status transitions
    if (updateTaskDto.status && updateTaskDto.status !== task.status) {
      this.logger.log(`🔄 Status transition attempt: ${task.status} → ${updateTaskDto.status} for task ${id}`);
      this.validateStatusTransition(task.status, updateTaskDto.status);
      this.logger.log(`✅ Status transition validated: ${task.status} → ${updateTaskDto.status}`);
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

    const updatedTask = await this.taskModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .exec();

    if (!updatedTask) {
      throw new NotFoundException('Task not found');
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