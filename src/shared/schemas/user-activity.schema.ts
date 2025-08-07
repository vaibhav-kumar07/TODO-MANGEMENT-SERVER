import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserActivityDocument = UserActivity & Document;

export enum ActivityType {
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  DASHBOARD_ACCESS = 'DASHBOARD_ACCESS',
  TASK_VIEW = 'TASK_VIEW',
  TASK_CREATE = 'TASK_CREATE',
  TASK_UPDATE = 'TASK_UPDATE',
  TASK_DELETE = 'TASK_DELETE',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  USER_INVITE = 'USER_INVITE',
  WEBSOCKET_CONNECT = 'WEBSOCKET_CONNECT',
  WEBSOCKET_DISCONNECT = 'WEBSOCKET_DISCONNECT',
}

@Schema({ timestamps: true })
export class UserActivity {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  userEmail: string;

  @Prop({ required: true })
  userRole: string;

  @Prop({ required: true, enum: ActivityType })
  activityType: ActivityType;

  @Prop({ required: true })
  description: string;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop()
  ipAddress: string;

  @Prop()
  userAgent: string;

  @Prop()
  sessionId: string;

  @Prop({ type: Date, default: Date.now })
  activityTime: Date;

  @Prop({ type: Number })
  sessionDuration: number; // in minutes

  @Prop({ type: Object })
  location: {
    country?: string;
    city?: string;
    timezone?: string;
  };

  @Prop({ default: true })
  isSuccessful: boolean;

  @Prop()
  errorMessage: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const UserActivitySchema = SchemaFactory.createForClass(UserActivity);

// Indexes for better query performance
UserActivitySchema.index({ userId: 1, activityTime: -1 });
UserActivitySchema.index({ activityType: 1, activityTime: -1 });
UserActivitySchema.index({ userEmail: 1, activityTime: -1 });
UserActivitySchema.index({ activityTime: -1 });
UserActivitySchema.index({ sessionId: 1 });
