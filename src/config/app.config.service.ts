import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  JwtConfigKey,
  DatabaseConfigKey,
  EmailConfigKey,
  RedisConfigKey,
  ServerConfigKey,
} from './environment.enum';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {
    this.validateCriticalConfig();
  }

  private validateCriticalConfig() {
    const requiredJwtSecrets = [
      JwtConfigKey.SECRET,
      JwtConfigKey.REFRESH_SECRET,
      JwtConfigKey.RESET_SECRET,
    ];

    for (const secret of requiredJwtSecrets) {
      if (!this.configService.get(secret)) {
        throw new Error(`${secret} environment variable is required.`);
      }
    }

    const requiredDbConfig = [DatabaseConfigKey.URI];
    for (const config of requiredDbConfig) {
      if (!this.configService.get(config)) {
        throw new Error(`${config} environment variable is required.`);
      }
    }
  }

  loadConfig() {
    return {
      server: this.loadServerConfig(),
      database: this.loadDatabaseConfig(),
      email: this.loadEmailConfig(),
      redis: this.loadRedisConfig(),
      jwt: this.loadJwtConfig(),
      websocket: this.loadWebSocketConfig(),
    };
  }

  private loadServerConfig() {
    return {
      port: this.configService.get<number>(ServerConfigKey.PORT, 3001),
      nodeEnv: this.configService.get<string>(ServerConfigKey.NODE_ENV, 'development'),
      frontendUrl: this.configService.get<string>(ServerConfigKey.FRONTEND_URL, 'http://localhost:3000'),
    };
  }

  private loadDatabaseConfig() {
    return {
      uri: this.configService.get<string>(DatabaseConfigKey.URI),
    };
  }

  private loadEmailConfig() {
    return {
      user: this.configService.get<string>(EmailConfigKey.USER),
      pass: this.configService.get<string>(EmailConfigKey.PASS),
    };
  }

  private loadRedisConfig() {
    return {
      host: this.configService.get<string>(RedisConfigKey.HOST, 'localhost'),
      port: this.configService.get<number>(RedisConfigKey.PORT, 6379),
      password: this.configService.get<string>(RedisConfigKey.PASSWORD),
      db: this.configService.get<number>(RedisConfigKey.DB, 0),
    };
  }

  private loadJwtConfig() {
    return {
      secret: this.configService.get<string>(JwtConfigKey.SECRET),
      expiresIn: this.configService.get<string>(JwtConfigKey.EXPIRES_IN, '24h'),
      refreshSecret: this.configService.get<string>(JwtConfigKey.REFRESH_SECRET),
      refreshExpiresIn: this.configService.get<string>(JwtConfigKey.REFRESH_EXPIRES_IN, '7d'),
      resetSecret: this.configService.get<string>(JwtConfigKey.RESET_SECRET),
    };
  }

  private loadWebSocketConfig() {
    return {
      port: this.configService.get<number>(ServerConfigKey.WS_PORT, 3002),
    };
  }
} 