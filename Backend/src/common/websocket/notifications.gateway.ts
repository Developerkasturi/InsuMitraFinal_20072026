// ─────────────────────────────────────────────────────────────────────────────
// Notifications Gateway — WebSocket real-time push via Socket.IO
//
// Clients connect to /notifications namespace and authenticate with JWT.
// On successful auth, the socket joins room `user:{userId}`.
// Call gateway.sendToUser(userId, event, payload) to push to a specific user.
// ─────────────────────────────────────────────────────────────────────────────
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger }      from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService }  from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  namespace:   '/notifications',
  cors: {
    origin: [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'https://insumitr.exportshub.in',
      'https://www.insumitr.exportshub.in',
      'https://insumitr.exportshub.in/',
      'https://www.insumitr.exportshub.in/',
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:5175',
    ].filter((v, i, a) => v && a.indexOf(v) === i),
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwt:    JwtService,
    private readonly config: ConfigService,
  ) {}

  // ── Connection lifecycle ───────────────────────────────────────────────────

  async handleConnection(socket: Socket) {
    try {
      const token =
        (socket.handshake.auth?.token as string) ??
        socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) throw new Error('No token');

      const payload = this.jwt.verify(token, {
        secret: this.config.get<string>('jwt.secret'),
      }) as { sub: string; tenantId: string };

      // Attach user info to socket and join their personal room
      (socket as any).userId   = payload.sub;
      (socket as any).tenantId = payload.tenantId;
      await socket.join(`user:${payload.sub}`);

      this.logger.log(`Socket connected: user=${payload.sub}`);
    } catch {
      // Disconnect unauthenticated sockets silently
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = (socket as any).userId;
    if (userId) this.logger.log(`Socket disconnected: user=${userId}`);
  }

  // ── Push notification to a specific user ──────────────────────────────────

  sendToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  // ── Client heartbeat (optional ping/pong) ────────────────────────────────

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() _socket: Socket, @MessageBody() _data: any) {
    return { event: 'pong', data: { ts: Date.now() } };
  }
}
