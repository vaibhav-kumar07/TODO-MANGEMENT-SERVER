import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { SharedModule } from '../shared/shared.module';
import { SeedService } from '../shared/database/seed.service';
import { JwtConfigKey } from '../config/environment.enum';
import { ConfigModule } from '../config/config.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get(JwtConfigKey.SECRET),
        signOptions: {
          expiresIn: configService.get(JwtConfigKey.EXPIRES_IN, '24h'),
        },
      }),
      inject: [ConfigService],
    }),
    SharedModule,
    WebsocketModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtStrategy],
})

export class AuthModule implements OnModuleInit {
  constructor(private seedService: SeedService) {}

  async onModuleInit() {
    await this.seedService.seedAdmin();
  }
} 