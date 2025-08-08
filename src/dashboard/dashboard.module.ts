import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ManagerDashboardController } from './manager-dashboard.controller';
import { ManagerDashboardService } from './manager-dashboard.service';
import { Task, TaskSchema } from '../tasks/schemas/task.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { WebsocketModule } from '../websocket/websocket.module';
import { UserActivity, UserActivitySchema } from '../shared/schemas/user-activity.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Task.name, schema: TaskSchema },
      { name: User.name, schema: UserSchema },
      { name: UserActivity.name, schema: UserActivitySchema }
    ]),
    WebsocketModule
  ],
  controllers: [
    DashboardController,
    ManagerDashboardController
  ],
  providers: [
    DashboardService,
    ManagerDashboardService
  ],
  exports: [
    DashboardService,
    ManagerDashboardService
  ]
})
export class DashboardModule {}