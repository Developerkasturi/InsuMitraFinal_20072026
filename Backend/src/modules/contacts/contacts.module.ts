import { Module }       from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { ContactsController }  from './contacts.controller';
import { ContactsService }     from './contacts.service';
import { ContactsRepository }  from './contacts.repository';

@Module({
  imports: [
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [ContactsController],
  providers:   [ContactsService, ContactsRepository],
  exports:     [ContactsService, ContactsRepository],
})
export class ContactsModule {}
