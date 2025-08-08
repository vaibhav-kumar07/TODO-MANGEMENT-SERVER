import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventType } from '../dashboard/dashboard.service';

@WebSocketGateway({
  namespace: '/dashboard',
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  }
})

export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DashboardGateway.name);
  private connectedClients = new Map<string, { socket: Socket; user: any }>();

  constructor(private jwtService: JwtService) {}

  
  afterInit(server: Server) {
    try {
      const wsPort = process.env.WS_PORT || 3002;
      this.logger.log(`🔌 WebSocket Gateway initialized on port ${wsPort}`);
      this.logger.log(`📡 Namespace: /dashboard`);
      this.logger.log(`🌐 CORS Origin: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      this.logger.log(`✅ WebSocket server is ready for connections`);
    } catch (error) {
      this.logger.error(`❌ WebSocket Gateway initialization failed: ${error.message}`);
    }
  }

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`🔌 New connection attempt from client: ${client.id}`);
      
      const token = client.handshake.auth.token || 
                   client.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        this.logger.error(`❌ Connection failed: No token provided for client ${client.id}`);
        client.emit('error', { 
          message: 'Authentication token required',
          code: 'AUTH_TOKEN_MISSING'
        });
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = this.jwtService.verify(token);
      const user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      // Store client data
      this.connectedClients.set(client.id, { socket: client, user });
      
      // Set user data on socket for guards to access
      client.data.user = user;
      
      // Join role-specific room
      client.join(`role-${user.role}`);
      client.join(`user-${user.id}`);

      this.logger.log(`✅ Client connected: ${user.email} (${user.role}) - ID: ${client.id}`);
      this.logger.log(`📊 Total connected clients: ${this.connectedClients.size}`);
      
      // Send connection confirmation
      client.emit('connected', {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        timestamp: Date.now(),
        message: 'WebSocket connection established successfully',
        clientId: client.id
      });
      
    } catch (error) {
      this.logger.error(`❌ Connection failed for client ${client.id}: ${error.message}`);
      
      // Send error to client before disconnecting
      client.emit('error', { 
        message: 'Authentication failed', 
        details: error.message,
        code: 'AUTH_FAILED'
      });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    try {
    const clientData = this.connectedClients.get(client.id);
    if (clientData) {
        this.logger.log(`❌ Client disconnected: ${clientData.user.email} - ID: ${client.id}`);
      this.connectedClients.delete(client.id);
        this.logger.log(`📊 Total connected clients: ${this.connectedClients.size}`);
      } else {
        this.logger.log(`❌ Unknown client disconnected: ${client.id}`);
      }
    } catch (error) {
      this.logger.error(`❌ Error handling disconnect for client ${client.id}: ${error.message}`);
    }
  }

  // Method to emit login events
  async emitLoginEvent(userId: string, userData: any) {
    try {
      this.server.emit(EventType.LOGIN, {
        userId,
        user: userData,
        timestamp: Date.now(),
        eventType: EventType.LOGIN
      });
      this.logger.log(`👤 Login event emitted for user: ${userData.email}`);
    } catch (error) {
      this.logger.error(`❌ Failed to emit login event: ${error.message}`);
    }
  }

  // Method to emit logout events
  async emitLogoutEvent(userId: string, userData: any) {
    try {
      this.server.emit(EventType.LOGOUT, {
        userId,
        user: userData,
        timestamp: Date.now(),
        eventType: EventType.LOGOUT
      });
      this.logger.log(`👤 Logout event emitted for user: ${userData.email}`);
    } catch (error) {
      this.logger.error(`❌ Failed to emit logout event: ${error.message}`);
    }
  }

  // Method to emit user created events
  async emitUserCreatedEvent(userId: string, userData: any, createdBy?: any) {
    try {
      this.server.emit(EventType.USER_CREATED, {
        userId,
        user: userData,
        timestamp: Date.now(),
        eventType: EventType.USER_CREATED,
        details: {
          createdBy: createdBy ? { id: createdBy.id, email: createdBy.email, role: createdBy.role } : null,
          userRole: userData.role
        }
      });
      this.logger.log(`👤 User created event emitted for user: ${userData.email}`);
    } catch (error) {
      this.logger.error(`❌ Failed to emit user created event: ${error.message}`);
    }
  }

  // Method to emit user activated events
  async emitUserActivatedEvent(userId: string, userData: any, activatedBy?: any) {
    try {
      this.server.emit(EventType.USER_ACTIVATED, {
        userId,
        user: userData,
        timestamp: Date.now(),
        eventType: EventType.USER_ACTIVATED,
        details: {
          activatedBy: activatedBy ? { id: activatedBy.id, email: activatedBy.email, role: activatedBy.role } : null
        }
      });
      this.logger.log(`👤 User activated event emitted for user: ${userData.email}`);
    } catch (error) {
      this.logger.error(`❌ Failed to emit user activated event: ${error.message}`);
    }
  }

  // Method to emit member added to team events
  async emitMemberAddedEvent(userId: string, userData: any, teamId: string, teamName: string, addedBy?: any) {
    try {
      this.server.emit(EventType.MEMBER_ADDED, {
        userId,
        user: userData,
        timestamp: Date.now(),
        eventType: EventType.MEMBER_ADDED,
        details: {
          teamId,
          teamName,
          addedBy: addedBy ? { id: addedBy.id, email: addedBy.email, role: addedBy.role } : null
        }
      });
      this.logger.log(`👤 Member added event emitted for user: ${userData.email} to team: ${teamName}`);
    } catch (error) {
      this.logger.error(`❌ Failed to emit member added event: ${error.message}`);
    }
  }

  // Method to emit member removed from team events
  async emitMemberRemovedEvent(userId: string, userData: any, teamId: string, teamName: string, removedBy?: any) {
    try {
      this.server.emit(EventType.MEMBER_REMOVED, {
        userId,
        user: userData,
        timestamp: Date.now(),
        eventType: EventType.MEMBER_REMOVED,
        details: {
          teamId,
          teamName,
          removedBy: removedBy ? { id: removedBy.id, email: removedBy.email, role: removedBy.role } : null
        }
      });
      this.logger.log(`👤 Member removed event emitted for user: ${userData.email} from team: ${teamName}`);
    } catch (error) {
      this.logger.error(`❌ Failed to emit member removed event: ${error.message}`);
    }
  }

  // Method to emit any user activity event
  async emitUserActivityEvent(eventType: EventType, userId: string, userData: any, details?: any) {
    try {
      this.server.emit(eventType, {
        userId,
        user: userData,
        timestamp: Date.now(),
        eventType,
        details
      });
      this.logger.log(`👤 ${eventType} event emitted for user: ${userData.email}`);
    } catch (error) {
      this.logger.error(`❌ Failed to emit ${eventType} event: ${error.message}`);
    }
  }

  getConnectedClients() {
    return Array.from(this.connectedClients.values()).map(client => ({
      id: client.socket.id,
      user: client.user
    }));
  }
} 