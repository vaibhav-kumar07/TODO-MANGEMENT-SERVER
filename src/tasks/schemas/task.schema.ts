import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type TaskDocument = Task & Document;

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export interface TaskHistoryItem {
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: Date;
  updatedBy: Types.ObjectId;
}

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true, enum: TaskStatus, default: TaskStatus.TODO })
  status: TaskStatus;

  @Prop({ required: true, enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @Prop({ type: Date })
  dueDate: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedBy: Types.ObjectId;

  @Prop({ required: true, default: false })
  isPersonal: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastUpdatedBy: Types.ObjectId;

  @Prop()
  lastAction: string;

  @Prop({ type: Date })
  lastStatusChangeAt: Date;

  @Prop({ type: Date })
  lastPriorityChangeAt: Date;

  @Prop({ type: Date })
  lastAssignedAt: Date;

  @Prop({ type: Date })
  lastDueDateChangeAt: Date;

  @Prop({ type: Date })
  completedAt: Date;

  @Prop({ type: Date })
  deletedAt: Date;

  @Prop([{
    field: { type: String },
    oldValue: { type: MongooseSchema.Types.Mixed },
    newValue: { type: MongooseSchema.Types.Mixed },
    timestamp: { type: Date },
    updatedBy: { type: Types.ObjectId, ref: 'User' }
  }])
  statusHistory: TaskHistoryItem[];

  @Prop([{
    field: { type: String },
    oldValue: { type: MongooseSchema.Types.Mixed },
    newValue: { type: MongooseSchema.Types.Mixed },
    timestamp: { type: Date },
    updatedBy: { type: Types.ObjectId, ref: 'User' }
  }])
  priorityHistory: TaskHistoryItem[];

  @Prop([{
    field: { type: String },
    oldValue: { type: MongooseSchema.Types.Mixed },
    newValue: { type: MongooseSchema.Types.Mixed },
    timestamp: { type: Date },
    updatedBy: { type: Types.ObjectId, ref: 'User' }
  }])
  assignmentHistory: TaskHistoryItem[];

  @Prop([{
    field: { type: String },
    oldValue: { type: MongooseSchema.Types.Mixed },
    newValue: { type: MongooseSchema.Types.Mixed },
    timestamp: { type: Date },
    updatedBy: { type: Types.ObjectId, ref: 'User' }
  }])
  dueDateHistory: TaskHistoryItem[];

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);