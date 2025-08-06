import { Controller, Get } from '@nestjs/common';
import { AppConfigService } from './config/app.config.service';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: AppConfigService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth() {
    const config = this.configService.loadConfig();
    const mongoUri = config.database.uri;
    return {
      status: 'ok',
      database: mongoUri ? 'connected' : 'not configured',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('db-status')
  getDatabaseStatus() {
    const config = this.configService.loadConfig();
    const mongoUri = config.database.uri;
    return {
      connected: mongoUri ? 'connected' : 'not configured',
      uri_set: mongoUri,
      timestamp: new Date().toISOString(),
    };
  }
}
