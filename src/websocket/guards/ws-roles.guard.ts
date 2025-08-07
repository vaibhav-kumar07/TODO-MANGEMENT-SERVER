import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UserRole } from '../../users/schemas/user.schema';

@Injectable()
export class WsRolesGuard implements CanActivate {
  private readonly logger = new Logger(WsRolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
        context.getHandler(),
        context.getClass(),
      ]);

      if (!requiredRoles) {
        return true;
      }

      const client: Socket = context.switchToWs().getClient();
      const user = client.data.user;

      if (!user) {
        throw new WsException('User not found in socket data');
      }

      if (!user.role) {
        throw new WsException('User role not found');
      }

      const hasRole = requiredRoles.some((role) => user.role === role);

      if (!hasRole) {
        this.logger.warn(`❌ Access denied: User ${user.email} (${user.role}) does not have required roles: ${requiredRoles.join(', ')}`);
        throw new WsException('Insufficient permissions');
      }

      this.logger.log(`✅ Role authorization successful for ${user.email} (${user.role})`);
      return true;

    } catch (error) {
      this.logger.error(`❌ Role authorization failed: ${error.message}`);
      throw new WsException('Authorization failed');
    }
  }
}
