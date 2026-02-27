import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";

interface SocketPayload {
  sub: string;
  email: string;
  role: string;
}

@WebSocketGateway({
  namespace: "/realtime",
  cors: {
    origin: true,
    credentials: true
  }
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth.token as string | undefined) ??
        (client.handshake.headers.authorization?.replace(/^Bearer\s+/i, "") ?? undefined);

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<SocketPayload>(token, {
        secret: this.configService.get<string>("JWT_ACCESS_SECRET")
      });

      client.data.user = payload;
      client.join(`user:${payload.sub}`);
    } catch (error) {
      this.logger.warn(`Socket authentication failed: ${(error as Error).message}`);
      client.disconnect();
    }
  }

  @SubscribeMessage("subscribe.import")
  onSubscribeImport(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { importJobId?: string }
  ): void {
    if (!payload?.importJobId) {
      return;
    }
    client.join(`import:${payload.importJobId}`);
  }

  @SubscribeMessage("subscribe.rooms")
  onSubscribeRooms(@ConnectedSocket() client: Socket, @MessageBody() payload: { date?: string }): void {
    if (!payload?.date) {
      return;
    }
    client.join(`rooms:${payload.date}`);
  }

  @SubscribeMessage("subscribe.notifications")
  onSubscribeNotifications(@ConnectedSocket() client: Socket): void {
    const userId = (client.data.user as SocketPayload | undefined)?.sub;
    if (!userId) {
      return;
    }
    client.join(`user:${userId}`);
  }

  @SubscribeMessage("subscribe.board")
  onSubscribeBoard(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { date?: string; scope?: "all" | "mine" }
  ): void {
    const scope = payload?.scope === "mine" ? "mine" : "all";
    const userId = (client.data.user as SocketPayload | undefined)?.sub;

    if (scope === "mine" && userId) {
      client.join(`board:mine:${userId}`);
      if (payload.date) {
        client.join(`board:mine:${userId}:${payload.date}`);
      }
      return;
    }

    client.join("board:all");
    if (payload?.date) {
      client.join(`board:all:${payload.date}`);
    }
  }

  emit(event: string, payload: unknown, room?: string): void {
    if (room) {
      this.server.to(room).emit(event, payload);
      return;
    }

    this.server.emit(event, payload);
  }
}
