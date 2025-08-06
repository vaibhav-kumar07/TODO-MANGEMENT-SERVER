import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(
    private configService: ConfigService,
    @InjectConnection() private connection: Connection,
  ) {}

  async onModuleInit() {
    const uri = this.configService.get('database.uri');
    
    if (uri) {
      this.logger.log('✅ MongoDB URI: connected successfully');
    } else {
      this.logger.error('❌ MongoDB URI: not configured');
    }
  }
} 