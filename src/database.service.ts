import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AppConfigService } from './config/app.config.service';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    private configService: AppConfigService,
    @InjectConnection() private connection: Connection,
  ) {}

  async onModuleInit() {
    const config = this.configService.loadConfig();
    const uri = config.database.uri;
    
    if (uri) {
      this.logger.log('✅ MongoDB URI: connected successfully');
    } else {
      this.logger.error('❌ MongoDB URI: not configured');
    }
  }
} 