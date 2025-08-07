import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EventLogDocument = EventLog & Document;

export enum EventType {
  USER_LOGIN = 'USER_LOGIN',
  USER_LOGOUT = 'USER_LOGOUT',
  USER_REGISTER = 'USER_REGISTER',
  USER_INVITATION = 'USER_INVITATION',
  USER_INVITATION_SUCCESS = 'USER_INVITATION_SUCCESS',
  USER_INVITATION_FAILED = 'USER_INVITATION_FAILED',
  USER_INVITATION_EXPIRED = 'USER_INVITATION_EXPIRED',
  PASSWORD_RESET = 'PASSWORD_RESET',
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
  PASSWORD_RESET_FAILED = 'PASSWORD_RESET_FAILED',
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_DELETED = 'TASK_DELETED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  SYSTEM_ALERT = 'SYSTEM_ALERT',
  DASHBOARD_ACCESS = 'DASHBOARD_ACCESS',
}

export enum EventSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

@Schema({ timestamps: true })
export class EventLog {
  @Prop({ required: true, enum: EventType })
  type: EventType;

  @Prop({ required: true })
  message: string;

  @Prop({ enum: EventSeverity, default: EventSeverity.LOW })
  severity: EventSeverity;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId: Types.ObjectId;

  @Prop()
  userEmail: string;

  @Prop()
  userRole: string;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop({ type: Object })
  ipAddress: string;

  @Prop()
  userAgent: string;

  @Prop({ default: Date.now })
  timestamp: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const EventLogSchema = SchemaFactory.createForClass(EventLog);

// Index for better query performance
EventLogSchema.index({ type: 1, timestamp: -1 });
EventLogSchema.index({ userId: 1, timestamp: -1 });
EventLogSchema.index({ timestamp: -1 });
