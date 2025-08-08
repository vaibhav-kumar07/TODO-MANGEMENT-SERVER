// Frontend WebSocket Event Listening for Manager Dashboard Task Events
const socket = io('http://localhost:3002/dashboard', {
  auth: {
    token: 'your-jwt-token-here',
  },
});

// 1. Task Created Event
socket.on('TASK_CREATED', (data) => {
  console.log('📝 Task created:', data);
  // data = {
  //   taskId: "507f1f77bcf86cd799439011",
  //   taskTitle: "Implement login feature",
  //   assignedTo: {
  //     userId: "507f1f77bcf86cd799439012",
  //     userName: "John Doe",
  //     userEmail: "john.doe@example.com"
  //   },
  //   status: "PENDING",
  //   priority: "HIGH",
  //   dueDate: "2024-01-15T00:00:00.000Z",
  //   eventType: "TASK_CREATED",
  //   timestamp: 1704722400000,
  //   performedBy: {
  //     userId: "507f1f77bcf86cd799439013",
  //     userName: "Manager Name",
  //     role: "manager"
  //   }
  // }
  updateManagerStats();
  addToActivityFeed(data);
});

// 2. Task Status Changed Event
socket.on('TASK_STATUS_CHANGED', (data) => {
  console.log('🔄 Task status changed:', data);
  // data = {
  //   taskId: "507f1f77bcf86cd799439011",
  //   taskTitle: "Implement login feature",
  //   status: "IN_PROGRESS",
  //   eventType: "TASK_STATUS_CHANGED",
  //   timestamp: 1704722400000,
  //   changes: {
  //     field: "status",
  //     oldValue: "PENDING",
  //     newValue: "IN_PROGRESS"
  //   }
  // }
  updateManagerStats();
  addToActivityFeed(data);
});

// 3. Task Priority Changed Event
socket.on('TASK_PRIORITY_CHANGED', (data) => {
  console.log('⚡ Task priority changed:', data);
  // data = {
  //   taskId: "507f1f77bcf86cd799439011",
  //   taskTitle: "Implement login feature",
  //   priority: "HIGH",
  //   eventType: "TASK_PRIORITY_CHANGED",
  //   timestamp: 1704722400000,
  //   changes: {
  //     field: "priority",
  //     oldValue: "MEDIUM",
  //     newValue: "HIGH"
  //   }
  // }
  updateManagerStats();
  addToActivityFeed(data);
});

// 4. Task Due Date Changed Event
socket.on('TASK_DUE_DATE_CHANGED', (data) => {
  console.log('📅 Task due date changed:', data);
  // data = {
  //   taskId: "507f1f77bcf86cd799439011",
  //   taskTitle: "Implement login feature",
  //   dueDate: "2024-01-20T00:00:00.000Z",
  //   eventType: "TASK_DUE_DATE_CHANGED",
  //   timestamp: 1704722400000,
  //   changes: {
  //     field: "dueDate",
  //     oldValue: "2024-01-15T00:00:00.000Z",
  //     newValue: "2024-01-20T00:00:00.000Z"
  //   }
  // }
  updateManagerStats();
  addToActivityFeed(data);
});

// 5. Task Assigned Event
socket.on('TASK_ASSIGNED', (data) => {
  console.log('👤 Task assigned:', data);
  // data = {
  //   taskId: "507f1f77bcf86cd799439011",
  //   taskTitle: "Implement login feature",
  //   assignedTo: {
  //     userId: "507f1f77bcf86cd799439012",
  //     userName: "John Doe",
  //     userEmail: "john.doe@example.com"
  //   },
  //   eventType: "TASK_ASSIGNED",
  //   timestamp: 1704722400000,
  //   changes: {
  //     field: "assignedTo",
  //     oldValue: null,
  //     newValue: "507f1f77bcf86cd799439012"
  //   }
  // }
  updateManagerStats();
  addToActivityFeed(data);
});

// 6. Task Completed Event
socket.on('TASK_COMPLETED', (data) => {
  console.log('✅ Task completed:', data);
  // data = {
  //   taskId: "507f1f77bcf86cd799439011",
  //   taskTitle: "Implement login feature",
  //   status: "COMPLETED",
  //   eventType: "TASK_COMPLETED",
  //   timestamp: 1704722400000,
  //   performedBy: {
  //     userId: "507f1f77bcf86cd799439012",
  //     userName: "John Doe",
  //     role: "member"
  //   }
  // }
  updateManagerStats();
  addToActivityFeed(data);
});

// 7. Task Updated Event (General updates)
socket.on('TASK_UPDATED', (data) => {
  console.log('📝 Task updated:', data);
  // data = {
  //   taskId: "507f1f77bcf86cd799439011",
  //   taskTitle: "Implement login feature",
  //   eventType: "TASK_UPDATED",
  //   timestamp: 1704722400000,
  //   changes: {
  //     field: "description",
  //     oldValue: "Old description",
  //     newValue: "Updated description"
  //   }
  // }
  updateManagerStats();
  addToActivityFeed(data);
});

// 8. Task Deleted Event
socket.on('TASK_DELETED', (data) => {
  console.log('🗑️ Task deleted:', data);
  // data = {
  //   taskId: "507f1f77bcf86cd799439011",
  //   taskTitle: "Implement login feature",
  //   eventType: "TASK_DELETED",
  //   timestamp: 1704722400000,
  //   performedBy: {
  //     userId: "507f1f77bcf86cd799439013",
  //     userName: "Manager Name",
  //     role: "manager"
  //   }
  // }
  updateManagerStats();
  addToActivityFeed(data);
});

// Helper functions to update dashboard components
function updateManagerStats() {
  fetch('/api/v1/manager-dashboard/stats')
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Update stats in UI
        updateTaskStats(data.data);
        updateTeamMemberStats(data.data);
        updateActivitySummary(data.data.todaysSummary);
      }
    });
}

function addToActivityFeed(eventData) {
  const taskEvent = {
    taskId: eventData.taskId,
    taskTitle: eventData.taskTitle,
    eventType: eventData.eventType,
    timestamp: new Date(eventData.timestamp),
    changes: eventData.changes,
    performedBy: eventData.performedBy,
  };

  // Add to activity feed in UI
  addEventToActivityFeed(taskEvent);
}

// Example UI update functions (implement these in your React components)
function updateTaskStats(stats) {
  console.log('Updating task stats:', stats);
}

function updateTeamMemberStats(stats) {
  console.log('Updating team member stats:', stats);
}

function updateActivitySummary(summary) {
  console.log('Updating activity summary:', summary);
}

function addEventToActivityFeed(event) {
  console.log('Adding event to activity feed:', event);
}
