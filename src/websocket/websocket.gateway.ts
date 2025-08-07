import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '../users/schemas/user.schema';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { WsRolesGuard } from './guards/ws-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/dashboard',
})
@UseGuards(WsJwtGuard, WsRolesGuard)
export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DashboardGateway.name);
  private connectedClients = new Map<string, { socket: Socket; user: any }>();

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      this.connectedClients.set(client.id, { socket: client, user });
      
      // Join role-specific room
      client.join(`role-${user.role}`);
      client.join(`user-${user.id}`);

      this.logger.log(`🔌 Client connected: ${user.email} (${user.role})`);
      
      // Send initial dashboard data
      await this.sendInitialDashboardData(client, user);
      
    } catch (error) {
      this.logger.error(`❌ Connection failed: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const clientData = this.connectedClients.get(client.id);
    if (clientData) {
      this.logger.log(`🔌 Client disconnected: ${clientData.user.email}`);
      this.connectedClients.delete(client.id);
    }
  }

  @SubscribeMessage('subscribe-dashboard')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async handleSubscribeDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { dashboardType: string }
  ) {
    const clientData = this.connectedClients.get(client.id);
    if (!clientData) return;

    const { user } = clientData;
    const { dashboardType } = data;

    this.logger.log(`📊 User ${user.email} subscribed to ${dashboardType} dashboard`);

    // Join dashboard-specific room
    client.join(`dashboard-${dashboardType}-${user.role}`);
  }

  @SubscribeMessage('unsubscribe-dashboard')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER)
  async handleUnsubscribeDashboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { dashboardType: string }
  ) {
    const clientData = this.connectedClients.get(client.id);
    if (!clientData) return;

    const { user } = clientData;
    const { dashboardType } = data;

    this.logger.log(`📊 User ${user.email} unsubscribed from ${dashboardType} dashboard`);

    // Leave dashboard-specific room
    client.leave(`dashboard-${dashboardType}-${user.role}`);
  }

  // Admin-only events
  @SubscribeMessage('admin-broadcast')
  @Roles(UserRole.ADMIN)
  async handleAdminBroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { event: string; payload: any }
  ) {
    const { event, payload } = data;
    this.server.to('role-ADMIN').emit(event, payload);
    this.logger.log(`📢 Admin broadcast: ${event}`);
  }

  // Manager-only events
  @SubscribeMessage('manager-broadcast')
  @Roles(UserRole.MANAGER)
  async handleManagerBroadcast(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { event: string; payload: any }
  ) {
    const { event, payload } = data;
    this.server.to('role-MANAGER').emit(event, payload);
    this.logger.log(`📢 Manager broadcast: ${event}`);
  }

  // Public methods for external services to emit events
  async emitUserActivity(userId: string, activity: any) {
    this.server.to(`user-${userId}`).emit('user-activity', activity);
  }

  async emitTaskUpdate(taskId: string, update: any, targetRoles: UserRole[] = []) {
    if (targetRoles.length === 0) {
      // Broadcast to all roles
      this.server.emit('task-update', { taskId, update });
    } else {
      // Broadcast to specific roles
      targetRoles.forEach(role => {
        this.server.to(`role-${role}`).emit('task-update', { taskId, update });
      });
    }
  }

  async emitUserStatusChange(userId: string, status: any, targetRoles: UserRole[] = []) {
    if (targetRoles.length === 0) {
      this.server.emit('user-status-change', { userId, status });
    } else {
      targetRoles.forEach(role => {
        this.server.to(`role-${role}`).emit('user-status-change', { userId, status });
      });
    }
  }

  async emitDashboardUpdate(role: UserRole, dashboardType: string, data: any) {
    this.server.to(`dashboard-${dashboardType}-${role}`).emit('dashboard-update', {
      dashboardType,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  async emitSystemAlert(alert: any, targetRoles: UserRole[] = []) {
    if (targetRoles.length === 0) {
      this.server.emit('system-alert', alert);
    } else {
      targetRoles.forEach(role => {
        this.server.to(`role-${role}`).emit('system-alert', alert);
      });
    }
  }

  private async sendInitialDashboardData(client: Socket, user: any) {
    // Send role-specific initial data
    const initialData = {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      timestamp: new Date().toISOString(),
    };

    client.emit('dashboard-initialized', initialData);
  }

  // Get connected clients info (admin only)
  @SubscribeMessage('get-connected-clients')
  @Roles(UserRole.ADMIN)
  async handleGetConnectedClients(@ConnectedSocket() client: Socket) {
    const clients = Array.from(this.connectedClients.values()).map(({ user }) => ({
      id: user.id,
      email: user.email,
      role: user.role,
    }));

    client.emit('connected-clients', clients);
  }
} 