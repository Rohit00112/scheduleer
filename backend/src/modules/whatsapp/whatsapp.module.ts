import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { SchedulesModule } from '../schedules/schedules.module';

@Module({
    imports: [SchedulesModule],
    controllers: [WhatsappController],
    providers: [WhatsappService],
})
export class WhatsappModule { }
