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
import { EventAction } from '../dashboard/interfaces/common';
import { TaskAction } from '../dashboard/interfaces/common'; 

@WebSocketGateway({
  namespace: '/dashboard',
  cors: {
    origin:'http://localhost:3000',
  },
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
      if (user.role === "MANAGER") {
        client.on('JOIN_MANAGER_ROOM', (managerId: string) => {
          client.join(`manager:${managerId}`);
          client.emit('JOINED_MANAGER_ROOM', { room: `manager:${managerId}` });
        });
        this.logger.log(`✅ Client joined manager room: ${user.id}`);
      }

     
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

  

  // Generic user event for aggregated counters
  async emitUserEvent(action: EventAction, data: {  isIncrement: boolean }) {
    try {
      this.server.emit('USER_EVENT', {
        action,
        isIncrement: data.isIncrement,
        timestamp: Date.now(),
      });
      this.logger.log(`📣 USER_EVENT emitted: ${action} (increment=${data.isIncrement})`);
    } catch (error) {
      this.logger.error(`❌ Failed to emit USER_EVENT ${action}: ${error.message}`);
    }
  }

  getConnectedClients() {
    return Array.from(this.connectedClients.values()).map(client => ({
      id: client.socket.id,
      user: client.user
    }));
  }

  // Manager-scoped task event
  async emitTaskEvent(managerId: string, action: TaskAction, isIncrement: boolean) {
    try {
      // this.server.to(`${managerId}`).emit('TASK_EVENT', {
      //   action,
      //   isIncrement,
      //   timestamp: Date.now(),
      // });
      this.server.to(`manager:${managerId}`).emit('TASK_EVENT', {action, isIncrement, timestamp: Date.now()});

      this.logger.log(`🧩 TASK_EVENT emitted to manager:${managerId} - ${action} (increment=${isIncrement})`);
    } catch (error) {
      this.logger.error(`❌ Failed to emit TASK_EVENT ${action} to manager:${managerId}: ${error.message}`);
    }
  }
} 