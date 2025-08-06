import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    const mongoUri = this.configService.get('database.uri');
    return {
      status: 'ok',
      database: mongoUri ? 'connected' : 'not configured',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('db-status')
  getDatabaseStatus() {
    const mongoUri = this.configService.get('database.uri');
    return {
      connected: mongoUri ? 'connected' : 'not configured',
      uri_set: mongoUri,
      timestamp: new Date().toISOString(),
    };
  }
}
