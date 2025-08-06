# Task Management API - cURL Commands

## Authentication

### Get Admin Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "admin123"
  }'
```

### Get Manager Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@example.com",
    "password": "manager123"
  }'
```

### Get Member Token
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "member@example.com",
    "password": "member123"
  }'
```

## Task Creation

### 1. Manager Creates Project Task
```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Design Homepage",
    "description": "Create modern homepage design",
    "priority": "HIGH",
    "dueDate": "2024-02-15T00:00:00.000Z",
    "assignedTo": "MEMBER_USER_ID",
    "isPersonal": false
  }'
```

### 2. Member Creates Personal Task
```bash
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Learn React",
    "description": "Study React fundamentals",
    "priority": "MEDIUM",
    "dueDate": "2024-02-25T00:00:00.000Z",
    "isPersonal": true
  }'
```

## Task Viewing

### 3. Get My Tasks (Member)
```bash
curl -X GET "http://localhost:3000/api/v1/tasks?view=my-tasks" \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

### 4. Get My Personal Tasks (Member)
```bash
curl -X GET "http://localhost:3000/api/v1/tasks?view=my-personal-tasks" \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

### 5. Get Created Tasks (Manager)
```bash
curl -X GET "http://localhost:3000/api/v1/tasks?view=created-by-me" \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN"
```

### 6. Get Project Tasks (Manager)
```bash
curl -X GET "http://localhost:3000/api/v1/tasks?view=team-tasks" \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN"
```

## Task Filtering

### 7. Filter by Status
```bash
curl -X GET "http://localhost:3000/api/v1/tasks?view=my-tasks&status=IN_PROGRESS" \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

### 8. Filter by Priority
```bash
curl -X GET "http://localhost:3000/api/v1/tasks?view=my-tasks&priority=HIGH" \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

### 9. Search Tasks
```bash
curl -X GET "http://localhost:3000/api/v1/tasks?view=my-tasks&search=design" \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

### 10. Combined Filters
```bash
curl -X GET "http://localhost:3000/api/v1/tasks?view=my-tasks&status=TODO&priority=HIGH&search=homepage" \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

## Task Pagination & Sorting

### 11. Pagination
```bash
curl -X GET "http://localhost:3000/api/v1/tasks?view=my-tasks&page=1&limit=5" \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

### 12. Sort by Priority
```bash
curl -X GET "http://localhost:3000/api/v1/tasks?view=my-tasks&sortBy=priority&sortOrder=desc" \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

### 13. Sort by Due Date
```bash
curl -X GET "http://localhost:3000/api/v1/tasks?view=my-tasks&sortBy=dueDate&sortOrder=asc" \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

## Task Updates

### 14. Member Updates Status
```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/TASK_ID \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "IN_PROGRESS"
  }'
```

### 15. Manager Updates Assignment
```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/TASK_ID \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "assignedTo": "NEW_MEMBER_ID",
    "priority": "HIGH",
    "dueDate": "2024-03-01T00:00:00.000Z"
  }'
```

### 16. Manager Completes Task
```bash
curl -X PATCH http://localhost:3000/api/v1/tasks/TASK_ID \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "DONE"
  }'
```

## Task Deletion

### 17. Manager Deletes Task
```bash
curl -X DELETE http://localhost:3000/api/v1/tasks/TASK_ID \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN"
```

### 18. Member Deletes Personal Task
```bash
curl -X DELETE http://localhost:3000/api/v1/tasks/PERSONAL_TASK_ID \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

## Get Specific Task

### 19. Get Task Details
```bash
curl -X GET http://localhost:3000/api/v1/tasks/TASK_ID \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN"
```

## Complete Workflow Example

### 20. Full Task Lifecycle
```bash
# Step 1: Create Task
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Complete Workflow Test",
    "description": "Testing complete task workflow",
    "priority": "HIGH",
    "dueDate": "2024-02-20T00:00:00.000Z",
    "assignedTo": "MEMBER_USER_ID",
    "isPersonal": false
  }'

# Step 2: Member Starts Task
curl -X PATCH http://localhost:3000/api/v1/tasks/TASK_ID \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "IN_PROGRESS"}'

# Step 3: Member Submits for Review
curl -X PATCH http://localhost:3000/api/v1/tasks/TASK_ID \
  -H "Authorization: Bearer YOUR_MEMBER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "REVIEW"}'

# Step 4: Manager Approves Task
curl -X PATCH http://localhost:3000/api/v1/tasks/TASK_ID \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "DONE"}'
```

## Replace Placeholders

- `YOUR_MANAGER_TOKEN`: JWT token from manager login
- `YOUR_MEMBER_TOKEN`: JWT token from member login  
- `TASK_ID`: Actual task ID from task creation response
- `MEMBER_USER_ID`: Actual member user ID
- `NEW_MEMBER_ID`: New member user ID for reassignment
- `PERSONAL_TASK_ID`: Personal task ID

## Expected Responses

- **Success**: 200/201 with task data
- **Permission Error**: 403 Forbidden
- **Validation Error**: 400 Bad Request
- **Not Found**: 404 Not Found
- **Pagination**: 200 with `{ tasks: [], pagination: {} }` 