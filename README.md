# Task Management System API

A NestJS-based Task Management System with MongoDB Atlas integration.

## 🚀 Features (Planned)

- **User Authentication**: Secure registration and login with JWT
- **Task Management**: Full CRUD operations for tasks
- **Task Assignment**: Assign tasks to team members
- **Dashboard**: Overview of created, assigned, and overdue tasks
- **Search & Filtering**: Advanced search with multiple criteria
- **Notifications**: In-app notification system
- **Security**: JWT authentication, password hashing, CORS protection

## 🛠 Tech Stack

- **Framework**: NestJS
- **Database**: MongoDB Atlas with Mongoose
- **Authentication**: JWT with Passport (planned)
- **Validation**: class-validator & class-transformer
- **Security**: Helmet, CORS, bcryptjs

## 📁 Project Structure

```
src/
├── config/             # Configuration management
├── app.controller.ts   # Basic health check endpoints
├── app.service.ts      # Application service
├── app.module.ts       # Root module
└── main.ts            # Application bootstrap
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB Atlas account
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd nest-crud-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp env.example .env
   # Edit .env with your MongoDB Atlas connection string
   ```

4. **Database Setup**
   ```bash
   # Set up MongoDB Atlas connection string in .env file
   # Copy your connection string from MongoDB Atlas dashboard
   ```

5. **Run the application**
   ```bash
   # Development
   npm run start:dev
   
   # Production
   npm run build
   npm run start:prod
   ```

## 📚 API Documentation

The API is available at `http://localhost:3000/api/v1`

### Current Endpoints
- `GET /` - Welcome message
- `GET /health` - Health check with database status

### Planned Endpoints
- Authentication endpoints (register, login, profile)
- Task CRUD endpoints
- Dashboard endpoints
- Search and filtering endpoints

## 🔧 Development

### Available Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build the application
- `npm run start:prod` - Start production server
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run end-to-end tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## 📝 Environment Variables

Copy `env.example` to `.env` and configure:

```env
# Application
PORT=3000
NODE_ENV=development

# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/task_management?retryWrites=true&w=majority

# JWT (for future use)
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=24h

# Bcrypt (for future use)
BCRYPT_SALT_ROUNDS=12
```

## 🆘 Support

For support, please open an issue in the GitHub repository.
