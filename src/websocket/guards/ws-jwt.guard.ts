import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = client.handshake.auth.token || 
                   client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        throw new WsException('Authentication token required');
      }

      const payload = this.jwtService.verify(token);
      
      if (!payload || !payload.sub || !payload.email || !payload.role) {
        throw new WsException('Invalid token payload');
      }

      // Set user data on socket for other guards to access
      client.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      this.logger.log(`✅ JWT authentication successful for ${payload.email}`);
      return true;

    } catch (error) {
      this.logger.error(`❌ JWT authentication failed: ${error.message}`);
      throw new WsException('Authentication failed');
    }
  }
}
