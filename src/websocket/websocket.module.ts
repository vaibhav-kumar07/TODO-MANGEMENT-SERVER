import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DashboardGateway } from './websocket.gateway';
import { WsJwtGuard } from './guards/ws-jwt.guard';
import { WsRolesGuard } from './guards/ws-roles.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'your-secret-key',
        signOptions: { 
          expiresIn: configService.get('JWT_EXPIRES_IN') || '24h' 
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [DashboardGateway, WsJwtGuard, WsRolesGuard],
  exports: [DashboardGateway],
})
export class WebsocketModule {} 