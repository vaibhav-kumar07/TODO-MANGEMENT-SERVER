import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { SharedModule } from './shared/shared.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from './config/config.module';
import { AppConfigService } from './config/app.config.service';
import { DatabaseService } from './database.service';
import { DatabaseConfigKey } from './config/environment.enum';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => {
        const uri = configService.get<string>(DatabaseConfigKey.URI);
        return {
          uri: uri,
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    TasksModule,
    SharedModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [AppService, DatabaseService],
})
export class AppModule {}
