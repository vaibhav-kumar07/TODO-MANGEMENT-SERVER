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


  @Get('my-stats')
  @Roles(UserRole.MEMBER)
  async getMyTaskStats(@Request() req) {
    this.logger.log(`Getting task stats - User ID: ${req.user.id}`);
    return this.tasksService.getMyTaskStats(req.user.id);
  }

  // Debug route to test if specific routes work
  @Get('test')
  async testRoute(@Request() req) {
    this.logger.log(`🎯 TEST ROUTE HIT - User ID: ${req.user.id}`);
    this.logger.log(`🎯 Full URL: ${req.url}`);
    return { message: 'Test route works!' };
  }

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

  // New route for manager-only task deletion
  @Delete('manager/:id')
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTaskAsManager(@Param('id') id: string, @Request() req) {
    this.logger.log(`🎯 MANAGER DELETE TASK ROUTE HIT - Task ID: ${id}, User ID: ${req.user.id}, Role: ${req.user.role}`);
    return this.tasksService.deleteTaskAsManager(id, req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Request() req) {
    this.logger.log(`Deleting task - Task ID: ${id}, User ID: ${req.user.id}, Role: ${req.user.role}`);
    return this.tasksService.remove(id, req.user.id);
  }
} 