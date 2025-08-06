import { IsOptional, IsEnum, IsString, IsBoolean, IsNumber, Min, Max, IsDateString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { TaskStatus, TaskPriority } from '../schemas/task.schema';

export class QueryTasksDto {
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
  @Transform(({ value }) => value === 'true' || value === true)
  isPersonal?: boolean;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDateString()
  dueDateFrom?: string; // Filter tasks due from this date

  @IsOptional()
  @IsDateString()
  dueDateTo?: string; // Filter tasks due until this date

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  overdue?: boolean; // Filter for overdue tasks only

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;
} 