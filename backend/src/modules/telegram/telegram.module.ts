import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
    imports: [SchedulesModule],
    providers: [TelegramService],
})
export class TelegramModule { }
