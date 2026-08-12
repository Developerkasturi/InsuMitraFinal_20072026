import { Module }       from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { ContactsController }  from './contacts.controller';
import { ContactsService }     from './contacts.service';
import { ContactsRepository }  from './contacts.repository';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
    NotificationsModule,
  ],
  controllers: [ContactsController],
  providers:   [ContactsService, ContactsRepository],
  exports:     [ContactsService, ContactsRepository],
})
export class ContactsModule {}
