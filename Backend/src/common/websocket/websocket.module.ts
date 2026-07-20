import { Global, Module } from '@nestjs/common';
import { JwtModule }      from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NotificationsGateway } from './notifications.gateway';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret:      cfg.get<string>('jwt.secret'),
        signOptions: { expiresIn: cfg.get<string>('jwt.expiresIn', '7d') },
      }),
    }),
  ],
  providers: [NotificationsGateway],
  exports:   [NotificationsGateway],
})
export class WebSocketModule {}
