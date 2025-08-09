import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { EventAction, EventSeverity } from 'src/dashboard/interfaces/common';
export type EventLogDocument = EventLog & Document;

@Schema({ timestamps: true })
export class EventLog {
  @Prop({ required: true, enum: EventAction }) 
  type: EventAction;

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
