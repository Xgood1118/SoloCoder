import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:4200',
    credentials: true,
  },
})
export class StatusGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe:deploy')
  handleSubscribeDeploy(client: Socket, deployId: string) {
    client.join(`deploy:${deployId}`);
  }

  @SubscribeMessage('unsubscribe:deploy')
  handleUnsubscribeDeploy(client: Socket, deployId: string) {
    client.leave(`deploy:${deployId}`);
  }

  @SubscribeMessage('subscribe:queue')
  handleSubscribeQueue(client: Socket) {
    client.join('queue:updates');
  }

  notifyDeployUpdate(deployId: string, data: any) {
    this.server.to(`deploy:${deployId}`).emit('deploy:updated', data);
  }

  notifyQueueUpdate(data: any) {
    this.server.to('queue:updates').emit('queue:updated', data);
  }

  notifyBuildUpdate(buildId: string, data: any) {
    this.server.emit(`build:${buildId}:updated`, data);
  }
}
