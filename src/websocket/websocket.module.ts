import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { DashboardGateway } from './websocket.gateway';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { WsRolesGuard } from './guards/ws-roles.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [DashboardGateway, WsJwtGuard, WsRolesGuard],
  exports: [DashboardGateway],
})
export class WebsocketModule {} 