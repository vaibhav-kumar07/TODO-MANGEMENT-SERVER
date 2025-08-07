import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailService } from './email/email.service';
import { SeedService } from './database/seed.service';
import { EventLog, EventLogSchema } from './schemas/event-log.schema';
import { UserActivity, UserActivitySchema } from './schemas/user-activity.schema';
import { ActivityLoggerService } from './services/activity-logger.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Team, TeamSchema } from '../teams/schemas/team.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Team.name, schema: TeamSchema },
      { name: EventLog.name, schema: EventLogSchema },
      { name: UserActivity.name, schema: UserActivitySchema },
    ]),
  ],
  providers: [EmailService, SeedService, ActivityLoggerService],
  exports: [
    MongooseModule,
    EmailService, 
    SeedService, 
    ActivityLoggerService
  ],
})

export class SharedModule {} 