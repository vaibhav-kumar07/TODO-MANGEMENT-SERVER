// Frontend WebSocket Event Listening for Admin Dashboard
// Connect to WebSocket
const socket = io('http://localhost:3002/dashboard', {
  auth: {
    token: 'your-jwt-token-here',
  },
});

// 1. LOGIN Event - Updates totalLogins and loginsToday
socket.on('LOGIN', (data) => {
  console.log('🔐 User logged in:', data);
  // data = {
  //   userId: "507f1f77bcf86cd799439011",
  //   user: { id, email, role, name },
  //   timestamp: 1704722400000,
  //   eventType: "LOGIN"
  // }

  // Update QuickStatsOverview.tsx
  updateLoginStats();

  // Update UserActivity.tsx
  addToRecentLogins(data);
});

// 2. USER_CREATED Event - Updates totalUsers
socket.on('USER_CREATED', (data) => {
  console.log('👤 User created:', data);
  // data = {
  //   userId: "507f1f77bcf86cd799439011",
  //   user: { id, email, role, name },
  //   timestamp: 1704722400000,
  //   eventType: "USER_CREATED",
  //   details: {
  //     createdBy: { id, email, role },
  //     userRole: "member"
  //   }
  // }

  // Update QuickStatsOverview.tsx
  updateTotalUsers();

  // Update UserActivity.tsx
  addToRecentUserEvents(data);
});

// 3. USER_ACTIVATED Event - Updates activeMembers
socket.on('USER_ACTIVATED', (data) => {
  console.log('✅ User activated:', data);
  // data = {
  //   userId: "507f1f77bcf86cd799439011",
  //   user: { id, email, role, name },
  //   timestamp: 1704722400000,
  //   eventType: "USER_ACTIVATED",
  //   details: {
  //     activatedBy: { id, email, role }
  //   }
  // }

  // Update QuickStatsOverview.tsx
  updateActiveMembers();

  // Update UserActivity.tsx
  addToRecentUserEvents(data);
});

// 4. MEMBER_ADDED Event - Updates activeMembers
socket.on('MEMBER_ADDED', (data) => {
  console.log('➕ Member added to team:', data);
  // data = {
  //   userId: "507f1f77bcf86cd799439011",
  //   user: { id, email, role, name },
  //   timestamp: 1704722400000,
  //   eventType: "MEMBER_ADDED",
  //   details: {
  //     teamId: "507f1f77bcf86cd799439012",
  //     teamName: "Development Team",
  //     addedBy: { id, email, role }
  //   }
  // }

  // Update QuickStatsOverview.tsx
  updateActiveMembers();

  // Update UserActivity.tsx
  addToRecentUserEvents(data);
});

// 5. MEMBER_REMOVED Event - Updates activeMembers
socket.on('MEMBER_REMOVED', (data) => {
  console.log('➖ Member removed from team:', data);
  // data = {
  //   userId: "507f1f77bcf86cd799439011",
  //   user: { id, email, role, name },
  //   timestamp: 1704722400000,
  //   eventType: "MEMBER_REMOVED",
  //   details: {
  //     teamId: "507f1f77bcf86cd799439012",
  //     teamName: "Development Team",
  //     removedBy: { id, email, role }
  //   }
  // }

  // Update QuickStatsOverview.tsx
  updateActiveMembers();

  // Update UserActivity.tsx
  addToRecentUserEvents(data);
});

// Helper functions to update dashboard components
function updateLoginStats() {
  // Call API to get updated stats
  fetch('/api/v1/dashboard/stats')
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Update QuickStatsOverview component
        updateQuickStats(data.data);
      }
    });
}

function updateTotalUsers() {
  // Call API to get updated stats
  fetch('/api/v1/dashboard/stats')
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Update QuickStatsOverview component
        updateQuickStats(data.data);
      }
    });
}

function updateActiveMembers() {
  // Call API to get updated stats
  fetch('/api/v1/dashboard/stats')
    .then((response) => response.json())
    .then((data) => {
      if (data.success) {
        // Update QuickStatsOverview component
        updateQuickStats(data.data);
      }
    });
}

function addToRecentLogins(loginData) {
  // Add to UserActivity component's recentLogins array
  const loginEvent = {
    userId: loginData.userId,
    userEmail: loginData.user.email,
    userName: loginData.user.name,
    userRole: loginData.user.role,
    timestamp: new Date(loginData.timestamp),
    ipAddress: loginData.details?.ipAddress,
    userAgent: loginData.details?.userAgent,
  };

  // Update UserActivity component
  addLoginToActivityFeed(loginEvent);
}

function addToRecentUserEvents(eventData) {
  // Add to UserActivity component's recentUserEvents array
  const userEvent = {
    userId: eventData.userId,
    userEmail: eventData.user.email,
    userName: eventData.user.name,
    userRole: eventData.user.role,
    action: eventData.eventType,
    timestamp: new Date(eventData.timestamp),
    details: eventData.details,
  };

  // Update UserActivity component
  addUserEventToActivityFeed(userEvent);
}

// Example component update functions (implement in your React components)
function updateQuickStats(stats) {
  // Update QuickStatsOverview.tsx with new stats
  console.log('Updating QuickStatsOverview with:', stats);
}

function addLoginToActivityFeed(loginEvent) {
  // Update UserActivity.tsx recentLogins array
  console.log('Adding login to activity feed:', loginEvent);
}

function addUserEventToActivityFeed(userEvent) {
  // Update UserActivity.tsx recentUserEvents array
  console.log('Adding user event to activity feed:', userEvent);
}
