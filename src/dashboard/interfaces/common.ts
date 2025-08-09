
// Event Types
export enum EventAction {
    //USER EVENTS
    LOGIN = 'LOGIN',
    LOGOUT = 'LOGOUT',
    USER_CREATED = 'USER_CREATED',
    MANAGER_ADDED = 'MANAGER_ADDED',
    MANAGER_REMOVED = 'MANAGER_REMOVED',
    MEMBER_ADDED = 'MEMBER_ADDED',
    MEMBER_REMOVED = 'MEMBER_REMOVED',
    BECOME_MANAGER = 'BECOME_MANAGER',
  
    //TASK EVENTS
        TASK_CREATED = 'TASK_CREATED',
        TASK_HIGH_PRIORITY = 'TASK_HIGH_PRIORITY',
        TASK_DUE_DATE = 'TASK_DUE_DATE',
        TASK_UPDATED = 'TASK_UPDATED',
        TASK_DELETED = 'TASK_DELETED',
        TASK_COMPLETED = 'TASK_COMPLETED',
        TASK_ASSIGNED = 'TASK_ASSIGNED',
        TASK_STATUS_CHANGED = 'TASK_STATUS_CHANGED',
        TASK_PRIORITY_CHANGED = 'TASK_PRIORITY_CHANGED',
        TASK_DUE_DATE_CHANGED = 'TASK_DUE_DATE_CHANGED',


        


    //event log
    USER_REGISTER = 'USER_REGISTER',
    PASSWORD_RESET = 'PASSWORD_RESET',
    PROFILE_UPDATE = 'PROFILE_UPDATE',
    USER_DELETED = 'USER_DELETED',
    USER_INVITED = 'USER_INVITED',
    USER_ACTIVATED = 'USER_ACTIVATED',
    USER_DEACTIVATED = 'USER_DEACTIVATED',
    USER_INVITATION_SUCCESS = 'USER_INVITATION_SUCCESS',
    USER_INVITATION_FAILED = 'USER_INVITATION_FAILED',
    USER_INVITATION_EXPIRED = 'USER_INVITATION_EXPIRED',
    PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS',
    PASSWORD_RESET_FAILED = 'PASSWORD_RESET_FAILED',
    SYSTEM_ALERT = 'SYSTEM_ALERT',
    DASHBOARD_ACCESS = 'DASHBOARD_ACCESS',
    
  
  }
  
  export enum SocketEvent {
    USER_EVENT = 'USER_EVENT',
    TASK_EVENT = 'TASK_EVENT',
    ACTIVITY_EVENT = 'ACTIVITY_EVENT',
  }

  export enum EventSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
  }
  
  // Interfaces for dashboard data
  export interface LoginEvent {
    userId: string;
    userEmail: string;
    userName: string;
    userRole: string;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
  }
  
  export interface UserEvent {
    userId: string;
    userEmail: string;
    userName: string;
    userRole: string;
    action: EventAction; 
    timestamp: Date;
    details?: any;
    createdAt: Date;
  }

  export interface ActivityUserDetails {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    teamId?: string;
    isActive?: boolean;
    isEmailVerified?: boolean;
    createdAt?: Date | string;
    updatedAt?: Date | string;
  }


  export interface AdminDashboardStats {
   
      totalUsers: number;
      totalManagers: number;
      totalMembers: number;
      totalLogins: number;
  }

  export interface ManagerDashboardStats {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    inProgressTasks: number;
    info:{
        managerId: string;
    }
  }
  
  export interface UserActivityData {
    recentUserEvents: UserEvent[];
  }
  


  
// Compact task counter actions for manager dashboards
export enum TaskAction {
    TASK_CREATED = 'TASK_CREATED',
    TASK_HIGH_PRIORITY = 'TASK_HIGH_PRIORITY',
    TASK_DUE_DATE = 'TASK_DUE_DATE',
    TASK_COMPLETED = 'TASK_COMPLETED',
    TASK_IN_PROGRESS = 'TASK_IN_PROGRESS',
  }
  
  
  export interface ManagerDashboardStats {
    totalTasks: number;
    overdueTasks: number;
    completedTasks: number;
    inProgressTasks: number;
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
    eventType: TaskAction;
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
    recentTaskEvents: TaskEvent[];
  }