import { Module } from '@nestjs/common';
import { NotificationsController }    from './notifications.controller';
import { NotificationsService }       from './notifications.service';
import { NotificationEngineService }  from './notification-engine.service';
import { WebSocketModule }            from '../../common/websocket/websocket.module';

@Module({
  imports:     [WebSocketModule],
  controllers: [NotificationsController],
  providers:   [NotificationsService, NotificationEngineService],
  exports:     [NotificationsService, NotificationEngineService],
})
export class NotificationsModule {}
