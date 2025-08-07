import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    try {
      const client: Socket = context.switchToWs().getClient();
      const token = this.extractToken(client);
      
      if (!token) {
        throw new WsException('Authentication token not found');
      }

      const payload = this.jwtService.verify(token);
      client.data.user = payload;
      
      return true;
    } catch (error) {
      throw new WsException('Invalid authentication token');
    }
  }

  private extractToken(client: Socket): string | undefined {
    return (
      client.handshake.auth.token ||
      client.handshake.headers.authorization?.replace('Bearer ', '')
    );
  }
} 