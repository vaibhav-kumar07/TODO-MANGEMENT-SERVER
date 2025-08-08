// Manager-specific interfaces for dashboard stats and activity

// Task-related event types
export enum TaskEventType {
  TASK_CREATED = 'TASK_CREATED',
  TASK_UPDATED = 'TASK_UPDATED',
  TASK_DELETED = 'TASK_DELETED',
  TASK_ASSIGNED = 'TASK_ASSIGNED',
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',
  TASK_PRIORITY_CHANGED = 'TASK_PRIORITY_CHANGED',
  TASK_DUE_DATE_CHANGED = 'TASK_DUE_DATE_CHANGED'
}

export interface ManagerStats {
  // Task Statistics
  totalTasks: number;
  tasksCreatedToday: number;
  pendingTasks: number;
  completedTasks: number;
  overdueTasks: number;
  highPriorityTasks: number;
  dueTodayTasks: number;
  
  // Member Statistics
  totalMembers: number;
  membersAddedToday: number;
  membersWithTasks: number;
  membersWithoutTasks: number;
  
  // Today's Activity Summary
  todaysSummary: {
    tasksCreated: number;
    tasksCompleted: number;
    tasksAssigned: number;
    tasksUpdated: number;
    tasksDeleted: number;
    statusChanges: number;
    priorityChanges: number;
    dueDateChanges: number;
  };
}

export interface TaskEvent {
  taskId: string;
  taskTitle: string;
  assignedTo?: {
    userId: string;
    userName: string;
    userEmail: string;
  };
  status?: string;
  priority?: string;
  dueDate?: Date;
  eventType: TaskEventType;
  timestamp: Date;
  changes?: {
    oldValue?: any;
    newValue?: any;
    field?: string;
  };
  performedBy: {
    userId: string;
    userName: string;
    role: string;
  };
}

export interface ManagerActivityData {
  // Recent Task Events
  recentTaskEvents: TaskEvent[];
  
  // Activity Summary by Event Type
  todaysSummary: {
    [TaskEventType.TASK_CREATED]: number;
    [TaskEventType.TASK_UPDATED]: number;
    [TaskEventType.TASK_DELETED]: number;
    [TaskEventType.TASK_ASSIGNED]: number;
    [TaskEventType.TASK_COMPLETED]: number;
    [TaskEventType.TASK_STATUS_CHANGED]: number;
    [TaskEventType.TASK_PRIORITY_CHANGED]: number;
    [TaskEventType.TASK_DUE_DATE_CHANGED]: number;
  };
}