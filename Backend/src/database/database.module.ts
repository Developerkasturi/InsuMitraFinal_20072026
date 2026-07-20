import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Make PrismaService available everywhere without importing DatabaseModule */
@Global()
@Module({
  providers: [PrismaService],
  exports:   [PrismaService],
})
export class DatabaseModule {}
