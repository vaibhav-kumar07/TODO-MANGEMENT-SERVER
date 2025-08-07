# Frontend Dashboard Integration Guide

## Overview
This guide shows how to integrate the real-time dashboard with role-based access control in the frontend.

## 1. WebSocket Connection Setup

### React Hook for WebSocket
```typescript
// hooks/useWebSocket.ts
import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseWebSocketProps {
  token: string;
  onDashboardUpdate: (data: any) => void;
  onTaskUpdate: (data: any) => void;
  onUserActivity: (data: any) => void;
  onSystemAlert: (data: any) => void;
}

export const useWebSocket = ({
  token,
  onDashboardUpdate,
  onTaskUpdate,
  onUserActivity,
  onSystemAlert,
}: UseWebSocketProps) => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    // Connect to WebSocket
    socketRef.current = io('http://localhost:3001/dashboard', {
      auth: { token },
      transports: ['websocket'],
    });

    // Connection events
    socketRef.current.on('connect', () => {
      setIsConnected(true);
      console.log('🔌 WebSocket connected');
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      console.log('🔌 WebSocket disconnected');
    });

    // Dashboard events
    socketRef.current.on('dashboard-initialized', (data) => {
      console.log('📊 Dashboard initialized:', data);
    });

    socketRef.current.on('dashboard-update', (data) => {
      console.log('📊 Dashboard update:', data);
      onDashboardUpdate(data);
    });

    socketRef.current.on('task-update', (data) => {
      console.log('📋 Task update:', data);
      onTaskUpdate(data);
    });

    socketRef.current.on('user-activity', (data) => {
      console.log('👤 User activity:', data);
      onUserActivity(data);
    });

    socketRef.current.on('system-alert', (data) => {
      console.log('🚨 System alert:', data);
      onSystemAlert(data);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [token]);

  const subscribeToDashboard = (dashboardType: string) => {
    if (socketRef.current) {
      socketRef.current.emit('subscribe-dashboard', { dashboardType });
    }
  };

  const unsubscribeFromDashboard = (dashboardType: string) => {
    if (socketRef.current) {
      socketRef.current.emit('unsubscribe-dashboard', { dashboardType });
    }
  };

  return {
    isConnected,
    subscribeToDashboard,
    unsubscribeFromDashboard,
  };
};
```

## 2. Role-Based Dashboard Components

### Admin Dashboard Component
```typescript
// components/dashboard/AdminDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

interface AdminDashboardData {
  users: {
    total: number;
    active: number;
    inactive: number;
    byRole: Record<string, number>;
  };
  tasks: {
    total: number;
    byStatus: Record<string, number>;
  };
  recentActivity: {
    tasks: any[];
    users: any[];
  };
  lastUpdated: string;
}

export const AdminDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const { isConnected, subscribeToDashboard } = useWebSocket({
    token: localStorage.getItem('token') || '',
    onDashboardUpdate: (data) => {
      if (data.dashboardType === 'admin') {
        setDashboardData(data.data);
      }
    },
    onTaskUpdate: (data) => {
      // Handle real-time task updates
      console.log('Task updated:', data);
    },
    onUserActivity: (data) => {
      // Handle user activity
      console.log('User activity:', data);
    },
    onSystemAlert: (data) => {
      // Handle system alerts
      console.log('System alert:', data);
    },
  });

  useEffect(() => {
    subscribeToDashboard('admin');
  }, []);

  if (!dashboardData) {
    return <div>Loading admin dashboard...</div>;
  }

  return (
    <div className="admin-dashboard">
      <h1>Admin Dashboard</h1>
      <div className="connection-status">
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      
      {/* User Statistics */}
      <div className="stats-section">
        <h2>User Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Users</h3>
            <p>{dashboardData.users.total}</p>
          </div>
          <div className="stat-card">
            <h3>Active Users</h3>
            <p>{dashboardData.users.active}</p>
          </div>
          <div className="stat-card">
            <h3>Inactive Users</h3>
            <p>{dashboardData.users.inactive}</p>
          </div>
        </div>
        
        <div className="role-distribution">
          <h3>Users by Role</h3>
          {Object.entries(dashboardData.users.byRole).map(([role, count]) => (
            <div key={role} className="role-item">
              <span>{role}:</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Task Statistics */}
      <div className="stats-section">
        <h2>Task Statistics</h2>
        <div className="stat-card">
          <h3>Total Tasks</h3>
          <p>{dashboardData.tasks.total}</p>
        </div>
        
        <div className="task-status">
          <h3>Tasks by Status</h3>
          {Object.entries(dashboardData.tasks.byStatus).map(([status, count]) => (
            <div key={status} className="status-item">
              <span>{status}:</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="activity-section">
        <h2>Recent Activity</h2>
        <div className="activity-grid">
          <div className="recent-tasks">
            <h3>Recent Tasks</h3>
            {dashboardData.recentActivity.tasks.map((task) => (
              <div key={task._id} className="activity-item">
                <span>{task.title}</span>
                <span>{task.status}</span>
              </div>
            ))}
          </div>
          
          <div className="recent-users">
            <h3>Recent Users</h3>
            {dashboardData.recentActivity.users.map((user) => (
              <div key={user._id} className="activity-item">
                <span>{user.firstName} {user.lastName}</span>
                <span>{user.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="last-updated">
        Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
};
```

### Manager Dashboard Component
```typescript
// components/dashboard/ManagerDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

interface ManagerDashboardData {
  members: {
    total: number;
    active: number;
    inactive: number;
  };
  tasks: {
    createdByManager: number;
    byStatus: Record<string, number>;
  };
  memberActivity: {
    members: any[];
  };
  lastUpdated: string;
}

export const ManagerDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<ManagerDashboardData | null>(null);
  const { isConnected, subscribeToDashboard } = useWebSocket({
    token: localStorage.getItem('token') || '',
    onDashboardUpdate: (data) => {
      if (data.dashboardType === 'manager') {
        setDashboardData(data.data);
      }
    },
    onTaskUpdate: (data) => {
      console.log('Task updated:', data);
    },
    onUserActivity: (data) => {
      console.log('User activity:', data);
    },
    onSystemAlert: (data) => {
      console.log('System alert:', data);
    },
  });

  useEffect(() => {
    subscribeToDashboard('manager');
  }, []);

  if (!dashboardData) {
    return <div>Loading manager dashboard...</div>;
  }

  return (
    <div className="manager-dashboard">
      <h1>Manager Dashboard</h1>
      <div className="connection-status">
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      
      {/* Member Statistics */}
      <div className="stats-section">
        <h2>Member Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Members</h3>
            <p>{dashboardData.members.total}</p>
          </div>
          <div className="stat-card">
            <h3>Active Members</h3>
            <p>{dashboardData.members.active}</p>
          </div>
          <div className="stat-card">
            <h3>Inactive Members</h3>
            <p>{dashboardData.members.inactive}</p>
          </div>
        </div>
      </div>

      {/* Task Statistics */}
      <div className="stats-section">
        <h2>Task Statistics</h2>
        <div className="stat-card">
          <h3>Tasks Created by You</h3>
          <p>{dashboardData.tasks.createdByManager}</p>
        </div>
        
        <div className="task-status">
          <h3>Tasks by Status</h3>
          {Object.entries(dashboardData.tasks.byStatus).map(([status, count]) => (
            <div key={status} className="status-item">
              <span>{status}:</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Member Activity */}
      <div className="activity-section">
        <h2>Member Activity</h2>
        <div className="member-list">
          {dashboardData.memberActivity.members.map((member) => (
            <div key={member._id} className="member-item">
              <span>{member.firstName} {member.lastName}</span>
              <span>{member.email}</span>
              <span className={`status ${member.isActive ? 'active' : 'inactive'}`}>
                {member.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="last-updated">
        Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
};
```

### Member Dashboard Component
```typescript
// components/dashboard/MemberDashboard.tsx
import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';

interface MemberDashboardData {
  tasks: {
    assigned: number;
    byStatus: Record<string, number>;
  };
  personalStats: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  recentActivity: {
    tasks: any[];
  };
  lastUpdated: string;
}

export const MemberDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<MemberDashboardData | null>(null);
  const { isConnected, subscribeToDashboard } = useWebSocket({
    token: localStorage.getItem('token') || '',
    onDashboardUpdate: (data) => {
      if (data.dashboardType === 'member') {
        setDashboardData(data.data);
      }
    },
    onTaskUpdate: (data) => {
      console.log('Task updated:', data);
    },
    onUserActivity: (data) => {
      console.log('User activity:', data);
    },
    onSystemAlert: (data) => {
      console.log('System alert:', data);
    },
  });

  useEffect(() => {
    subscribeToDashboard('member');
  }, []);

  if (!dashboardData) {
    return <div>Loading member dashboard...</div>;
  }

  return (
    <div className="member-dashboard">
      <h1>My Dashboard</h1>
      <div className="connection-status">
        Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>
      
      {/* Personal Statistics */}
      <div className="stats-section">
        <h2>My Statistics</h2>
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Assigned Tasks</h3>
            <p>{dashboardData.tasks.assigned}</p>
          </div>
          <div className="stat-card">
            <h3>Completed Tasks</h3>
            <p>{dashboardData.personalStats.completedTasks}</p>
          </div>
          <div className="stat-card">
            <h3>Overdue Tasks</h3>
            <p>{dashboardData.personalStats.overdueTasks}</p>
          </div>
          <div className="stat-card">
            <h3>Completion Rate</h3>
            <p>{dashboardData.personalStats.completionRate}%</p>
          </div>
        </div>
      </div>

      {/* Task Status */}
      <div className="stats-section">
        <h2>My Tasks by Status</h2>
        <div className="task-status">
          {Object.entries(dashboardData.tasks.byStatus).map(([status, count]) => (
            <div key={status} className="status-item">
              <span>{status}:</span>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="activity-section">
        <h2>My Recent Activity</h2>
        <div className="task-list">
          {dashboardData.recentActivity.tasks.map((task) => (
            <div key={task._id} className="task-item">
              <span>{task.title}</span>
              <span className={`status ${task.status.toLowerCase()}`}>
                {task.status}
              </span>
              <span>{new Date(task.updatedAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="last-updated">
        Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
};
```

## 3. Role-Based Dashboard Router

```typescript
// components/DashboardRouter.tsx
import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { AdminDashboard } from './dashboard/AdminDashboard';
import { ManagerDashboard } from './dashboard/ManagerDashboard';
import { MemberDashboard } from './dashboard/MemberDashboard';

export const DashboardRouter: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <div>Loading...</div>;
  }

  switch (user.role) {
    case 'ADMIN':
      return <AdminDashboard />;
    case 'MANAGER':
      return <ManagerDashboard />;
    case 'MEMBER':
      return <MemberDashboard />;
    default:
      return <div>Invalid user role</div>;
  }
};
```

## 4. API Integration

```typescript
// services/dashboardService.ts
import { apiClient } from './apiClient';

export const dashboardService = {
  // Get initial dashboard data
  async getDashboardData(role: string) {
    const response = await apiClient.get(`/dashboard/${role.toLowerCase()}`);
    return response.data;
  },

  // Get auto dashboard (based on user role)
  async getAutoDashboard() {
    const response = await apiClient.get('/dashboard/auto');
    return response.data;
  },
};
```

## 5. CSS Styling Example

```css
/* styles/dashboard.css */
.dashboard {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.connection-status {
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 5px;
  background-color: #f0f0f0;
  font-weight: bold;
}

.stats-section {
  margin-bottom: 30px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.stat-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-align: center;
}

.stat-card h3 {
  margin: 0 0 10px 0;
  color: #666;
  font-size: 14px;
}

.stat-card p {
  margin: 0;
  font-size: 24px;
  font-weight: bold;
  color: #333;
}

.activity-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.activity-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
}

.status.active {
  background-color: #d4edda;
  color: #155724;
}

.status.inactive {
  background-color: #f8d7da;
  color: #721c24;
}

.last-updated {
  text-align: center;
  color: #666;
  font-size: 12px;
  margin-top: 20px;
}
```

## 6. Usage in App Component

```typescript
// App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { DashboardRouter } from './components/DashboardRouter';
import { Login } from './components/Login';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<DashboardRouter />} />
            <Route path="/" element={<DashboardRouter />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
```

## Key Features

1. **Role-Based Access**: Different dashboards for Admin, Manager, and Member
2. **Real-Time Updates**: WebSocket connection for live data updates
3. **Auto-Detection**: Automatic dashboard selection based on user role
4. **Connection Status**: Visual indicator of WebSocket connection status
5. **Responsive Design**: Grid-based layout that adapts to screen size
6. **Error Handling**: Graceful handling of connection issues and data loading

## WebSocket Events

- `dashboard-initialized`: Sent when dashboard is first loaded
- `dashboard-update`: Real-time dashboard data updates
- `task-update`: Task creation, updates, and status changes
- `user-activity`: User login, logout, and activity tracking
- `system-alert`: System-wide notifications and alerts

This implementation provides a complete real-time dashboard solution with role-based access control and live updates! 🚀 