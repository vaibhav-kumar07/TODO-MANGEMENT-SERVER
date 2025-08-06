import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task, TaskDocument, TaskStatus } from './schemas/task.schema';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto, TaskView } from './dto/query-tasks.dto';
import { User, UserRole } from '../users/schemas/user.schema';

@Injectable()
export class TasksService {
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
      taskData.teamId = user.teamId;
    } else {
      // Handle team tasks
      if (user.role !== UserRole.MANAGER) {
        throw new ForbiddenException('Only managers can create team tasks');
      }

      if (!createTaskDto.assignedTo) {
        throw new BadRequestException('Team tasks must be assigned to a member');
      }

      // Verify assigned user is a member in the same team
      const assignedUser = await this.userModel.findById(createTaskDto.assignedTo);
      if (!assignedUser || assignedUser.role !== UserRole.MEMBER || assignedUser.teamId?.toString() !== user.teamId?.toString()) {
        throw new BadRequestException('Can only assign tasks to members in your team');
      }

      taskData.assignedTo = new Types.ObjectId(createTaskDto.assignedTo);
      taskData.teamId = user.teamId;
      taskData.isPersonal = false;
    }

    if (createTaskDto.dueDate) {
      taskData.dueDate = new Date(createTaskDto.dueDate);
    }

    const task = new this.taskModel(taskData);
    return task.save();
  }

  async findAll(queryDto: QueryTasksDto, userId: string): Promise<Task[]> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const filter: any = {};

    // Apply view filters
    switch (queryDto.view) {
      case TaskView.MY_TASKS:
        filter.assignedTo = new Types.ObjectId(userId);
        filter.isPersonal = false;
        break;
      
      case TaskView.MY_PERSONAL_TASKS:
        filter.createdBy = new Types.ObjectId(userId);
        filter.isPersonal = true;
        break;
      
      case TaskView.CREATED_BY_ME:
        if (user.role !== UserRole.MANAGER) {
          throw new ForbiddenException('Only managers can view created tasks');
        }
        filter.createdBy = new Types.ObjectId(userId);
        filter.isPersonal = false;
        filter.teamId = user.teamId; // Only show tasks from their team
        break;
      
      case TaskView.TEAM_TASKS:
        if (user.role !== UserRole.MANAGER) {
          throw new ForbiddenException('Only managers can view team tasks');
        }
        filter.teamId = user.teamId;
        filter.isPersonal = false;
        break;
      
      default:
        // Default view based on user role
        if (user.role === UserRole.MANAGER) {
          filter.$or = [
            { createdBy: new Types.ObjectId(userId) },
            { assignedTo: new Types.ObjectId(userId) },
          ];
        } else {
          filter.assignedTo = new Types.ObjectId(userId);
        }
    }

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

    return this.taskModel
      .find(filter)
      .populate('assignedTo', 'firstName lastName email')
      .populate('assignedBy', 'firstName lastName email')
      .populate('createdBy', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .exec();
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
      if (task.createdBy.toString() !== userId) {
        throw new ForbiddenException('Cannot access personal task of another user');
      }
    } else {
      // Team task permissions
      if (user.role === UserRole.MEMBER) {
        if (task.assignedTo.toString() !== userId) {
          throw new ForbiddenException('Cannot access team task not assigned to you');
        }
      } else if (user.role === UserRole.MANAGER) {
        if (task.teamId.toString() !== user.teamId.toString()) {
          throw new ForbiddenException('Cannot access task from another team');
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
      if (task.createdBy.toString() !== userId) {
        throw new ForbiddenException('Cannot modify personal task of another user');
      }
    } else {
      // Team task permissions
      if (user.role === UserRole.MEMBER) {
        throw new ForbiddenException('Members cannot modify team tasks');
      } else if (user.role === UserRole.MANAGER) {
        if (task.createdBy.toString() !== userId) {
          throw new ForbiddenException('Can only modify tasks you created');
        }
        if (task.teamId.toString() !== user.teamId.toString()) {
          throw new ForbiddenException('Cannot modify task from another team');
        }
      }
    }

    // Handle status transitions
    if (updateTaskDto.status && updateTaskDto.status !== task.status) {
      this.validateStatusTransition(task.status, updateTaskDto.status);
    }

    // Handle assignment changes
    if (updateTaskDto.assignedTo && !task.isPersonal) {
      const assignedUser = await this.userModel.findById(updateTaskDto.assignedTo);
      if (!assignedUser || assignedUser.role !== UserRole.MEMBER || assignedUser.teamId?.toString() !== user.teamId?.toString()) {
        throw new BadRequestException('Can only assign tasks to members in your team');
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
      if (task.createdBy.toString() !== userId) {
        throw new ForbiddenException('Cannot delete personal task of another user');
      }
    } else {
      // Team task permissions
      if (user.role === UserRole.MEMBER) {
        throw new ForbiddenException('Members cannot delete team tasks');
      } else if (user.role === UserRole.MANAGER) {
        if (task.createdBy.toString() !== userId) {
          throw new ForbiddenException('Can only delete tasks you created');
        }
        if (task.teamId.toString() !== user.teamId.toString()) {
          throw new ForbiddenException('Cannot delete task from another team');
        }
      }
    }

    await this.taskModel.findByIdAndDelete(id);
  }

  private validateStatusTransition(currentStatus: TaskStatus, newStatus: TaskStatus): void {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      [TaskStatus.TODO]: [TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.IN_PROGRESS]: [TaskStatus.REVIEW, TaskStatus.CANCELLED],
      [TaskStatus.REVIEW]: [TaskStatus.DONE, TaskStatus.IN_PROGRESS, TaskStatus.CANCELLED],
      [TaskStatus.DONE]: [],
      [TaskStatus.CANCELLED]: [],
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new BadRequestException(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }
} 