import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  Query, 
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  Logger
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  private readonly logger = new Logger(TasksController.name);

  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createTaskDto: CreateTaskDto, @Request() req) {
    this.logger.log(`Creating task - User ID: ${req.user.id}, Role: ${req.user.role}`);
    return this.tasksService.createTask(createTaskDto, req.user.id);
  }

  @Get()
  async findAll(@Query() queryDto: QueryTasksDto, @Request() req) {
    this.logger.log(`Getting tasks - User ID: ${req.user.id}, Role: ${req.user.role}`);
    return this.tasksService.findAll(queryDto, req.user.id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Request() req) {
    this.logger.log(`Getting task - Task ID: ${id}, User ID: ${req.user.id}`);
    return this.tasksService.findOne(id, req.user.id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateTaskDto: UpdateTaskDto, 
    @Request() req
  ) {
    this.logger.log(`Updating task - Task ID: ${id}, User ID: ${req.user.id}, Role: ${req.user.role}`);
    return this.tasksService.update(id, updateTaskDto, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req) {
    this.logger.log(`Deleting task - Task ID: ${id}, User ID: ${req.user.id}, Role: ${req.user.role}`);
    return this.tasksService.remove(id, req.user.id);
  }
} 