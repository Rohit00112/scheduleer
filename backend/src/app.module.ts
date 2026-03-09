import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { Schedule } from './entities/schedule.entity';
import { User } from './entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { Announcement } from './entities/announcement.entity';
import { Room } from './entities/room.entity';
import { ModuleCatalog } from './entities/module-catalog.entity';
import { TeacherAssignment } from './entities/teacher-assignment.entity';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { AuthModule } from './modules/auth/auth.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { UsersModule } from './modules/users/users.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { InstructorsModule } from './modules/instructors/instructors.module';
import { WhatsappModule } from './modules/whatsapp/whatsapp.module';
import { TelegramModule } from './modules/telegram/telegram.module';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: join(__dirname, '..', 'data', 'scheduler.db'),
      entities: [Schedule, User, AuditLog, Announcement, Room, ModuleCatalog, TeacherAssignment],
      synchronize: true,
    }),
    SchedulesModule,
    AuthModule,
    AnnouncementsModule,
    UsersModule,
    RoomsModule,
    ProgramsModule,
    InstructorsModule,
    WhatsappModule,
    TelegramModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
