import { Controller, Get, UseGuards, Request, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { ManagerDashboardService } from './manager-dashboard.service';

@Controller('dashboard/manager')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MANAGER)
export class ManagerDashboardController {
  private readonly logger = new Logger(ManagerDashboardController.name);

  constructor(private readonly managerDashboardService: ManagerDashboardService) {}

  @Get('stats')
  async getManagerStats(@Request() req) {
    this.logger.log(`📊 Manager stats requested by: ${req.user.email}`);
    return this.managerDashboardService.getManagerStats(req.user.id);
  }

  @Get('activity')
  async getManagerActivity(@Request() req) {
    this.logger.log(`📊 Manager activity requested by: ${req.user.email}`);
    return this.managerDashboardService.getManagerActivity(req.user.id);
  }
}
