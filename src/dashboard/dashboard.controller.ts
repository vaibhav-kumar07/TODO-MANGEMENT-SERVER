import { Controller, Get, UseGuards, Request, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('login-count')
  async getLoginCount(@Request() req) {
    this.logger.log(`📊 Login count requested by: ${req.user.email}`);
    return this.dashboardService.getLoginCount();
  }

  @Get('stats')
  async getDashboardStats(@Request() req) {
    this.logger.log(`📊 Dashboard stats requested by: ${req.user.email}`);
    return this.dashboardService.getDashboardStats();
  }

  @Get('user-activity')
  async getUserActivity(@Request() req) {
    this.logger.log(`📊 User activity requested by: ${req.user.email}`);
    return this.dashboardService.getUserActivity();
  }
} 