import { Controller, Get, UseGuards, Request, Logger } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin')
  @Roles(UserRole.ADMIN)
  async getAdminDashboard(@Request() req) {
    this.logger.log(`📊 Admin dashboard requested by: ${req.user.email}`);
    return this.dashboardService.getAdminDashboardData();
  }

  @Get('manager')
  @Roles(UserRole.MANAGER)
  async getManagerDashboard(@Request() req) {
    this.logger.log(`📊 Manager dashboard requested by: ${req.user.email}`);
    return this.dashboardService.getManagerDashboardData(req.user.id);
  }

  @Get('member')
  @Roles(UserRole.MEMBER)
  async getMemberDashboard(@Request() req) {
    this.logger.log(`📊 Member dashboard requested by: ${req.user.email}`);
    return this.dashboardService.getMemberDashboardData(req.user.id);
  }

  @Get('auto')
  async getAutoDashboard(@Request() req) {
    this.logger.log(`📊 Auto dashboard requested by: ${req.user.email} (${req.user.role})`);
    
    switch (req.user.role) {
      case UserRole.ADMIN:
        return this.dashboardService.getAdminDashboardData();
      case UserRole.MANAGER:
        return this.dashboardService.getManagerDashboardData(req.user.id);
      case UserRole.MEMBER:
        return this.dashboardService.getMemberDashboardData(req.user.id);
      default:
        return {
          success: false,
          error: 'Invalid user role',
          message: 'Unable to determine dashboard type for user role',
        };
    }
  }
} 