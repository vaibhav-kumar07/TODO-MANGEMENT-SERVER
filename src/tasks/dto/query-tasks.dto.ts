import { IsOptional, IsEnum, IsString, IsBoolean } from 'class-validator';
import { TaskStatus, TaskPriority } from '../schemas/task.schema';

export enum TaskView {
  MY_TASKS = 'my-tasks',
  MY_PERSONAL_TASKS = 'my-personal-tasks',
  CREATED_BY_ME = 'created-by-me',
  TEAM_TASKS = 'team-tasks',
}

export class QueryTasksDto {
  @IsOptional()
  @IsEnum(TaskView)
  view?: TaskView;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  assignedTo?: string;

  @IsOptional()
  @IsBoolean()
  isPersonal?: boolean;
} 