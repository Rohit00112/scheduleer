import { Injectable, Logger } from '@nestjs/common';
import { SchedulesService } from '../schedules/schedules.service';
import { Schedule } from '../../entities/schedule.entity';
import * as twilio from 'twilio';

@Injectable()
export class WhatsappService {
    private readonly logger = new Logger(WhatsappService.name);
    private twilioClient: twilio.Twilio | null = null;

    constructor(private readonly schedulesService: SchedulesService) {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        if (accountSid && authToken) {
            this.twilioClient = twilio.default(accountSid, authToken);
            this.logger.log('Twilio client initialized');
        } else {
            this.logger.warn(
                'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set. WhatsApp bot will not send messages.',
            );
        }
    }

    async handleIncomingMessage(from: string, body: string): Promise<string> {
        const message = body.trim().toLowerCase();
        this.logger.log(`Received message from ${from}: ${body}`);

        try {
            if (message === 'help' || message === 'hi' || message === 'hello') {
                return this.getHelpMessage();
            }

            if (message === 'today') {
                return this.getTodaySchedule();
            }

            if (message.startsWith('day ')) {
                const day = this.parseDay(message.substring(4).trim());
                if (!day) return `Invalid day. Use: Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday`;
                return this.getScheduleByDay(day);
            }

            if (message.startsWith('instructor ')) {
                const rest = body.trim().substring(11).trim();
                const { name, day } = this.extractNameAndDay(rest);
                return this.getScheduleByInstructor(name, day);
            }

            if (message.startsWith('room ')) {
                const rest = body.trim().substring(5).trim();
                const { name, day } = this.extractNameAndDay(rest);
                return this.getScheduleByRoom(name, day);
            }

            if (message.startsWith('program ')) {
                const rest = body.trim().substring(8).trim();
                const { name, day } = this.extractNameAndDay(rest);
                return this.getScheduleByProgram(name, day);
            }

            if (message === 'instructors') {
                return this.listInstructors();
            }

            if (message === 'rooms') {
                return this.listRooms();
            }

            if (message === 'programs') {
                return this.listPrograms();
            }

            return this.getHelpMessage();
        } catch (error) {
            this.logger.error(`Error handling message: ${error.message}`);
            return 'Sorry, something went wrong. Please try again later.';
        }
    }

    async sendReply(to: string, message: string): Promise<void> {
        const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
        if (!this.twilioClient || !fromNumber) {
            this.logger.warn('Twilio client not configured, cannot send reply');
            return;
        }

        // Split long messages (WhatsApp limit is 1600 chars)
        const chunks = this.splitMessage(message, 1500);
        for (const chunk of chunks) {
            await this.twilioClient.messages.create({
                from: `whatsapp:${fromNumber}`,
                to: to,
                body: chunk,
            });
        }
    }

    validateTwilioSignature(
        url: string,
        params: Record<string, string>,
        signature: string,
    ): boolean {
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        if (!authToken) return false;
        return twilio.validateRequest(authToken, signature, url, params);
    }

    private getHelpMessage(): string {
        return [
            '📅 *Schedule Bot Commands*',
            '',
            '*today* - Today\'s schedule',
            '*day <name>* - Schedule for a day (e.g. day monday)',
            '*instructor <name>* - Schedule by instructor',
            '*instructor <name> <day>* - Instructor on a specific day',
            '*room <name>* - Schedule by room',
            '*room <name> <day>* - Room on a specific day',
            '*program <name>* - Schedule by program',
            '*program <name> <day>* - Program on a specific day',
            '*instructors* - List all instructors',
            '*rooms* - List all rooms',
            '*programs* - List all programs',
            '*help* - Show this help message',
        ].join('\n');
    }

    private async getTodaySchedule(): Promise<string> {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const today = days[new Date().getDay()];
        return this.getScheduleByDay(today);
    }

    private async getScheduleByDay(day: string): Promise<string> {
        const schedules = await this.schedulesService.findAll({ day });
        if (schedules.length === 0) return `No classes scheduled for ${day}.`;
        return `📅 *${day}'s Schedule*\n\n${this.formatSchedules(schedules)}`;
    }

    private async getScheduleByInstructor(name: string, day?: string): Promise<string> {
        const filter: any = { instructor: name };
        if (day) filter.day = day;
        const schedules = await this.schedulesService.findAll(filter);
        const label = day ? `${name} on ${day}` : name;
        if (schedules.length === 0) return `No schedules found for instructor "${label}".`;
        return `👨‍🏫 *Schedule for ${label}*\n\n${this.formatSchedules(schedules)}`;
    }

    private async getScheduleByRoom(room: string, day?: string): Promise<string> {
        const filter: any = { room };
        if (day) filter.day = day;
        const schedules = await this.schedulesService.findAll(filter);
        const label = day ? `${room} on ${day}` : room;
        if (schedules.length === 0) return `No schedules found for room "${label}".`;
        return `🏫 *Schedule for Room ${label}*\n\n${this.formatSchedules(schedules)}`;
    }

    private async getScheduleByProgram(program: string, day?: string): Promise<string> {
        const filter: any = { program };
        if (day) filter.day = day;
        const schedules = await this.schedulesService.findAll(filter);
        const label = day ? `${program} on ${day}` : program;
        if (schedules.length === 0) return `No schedules found for program "${label}".`;
        return `📚 *Schedule for ${label}*\n\n${this.formatSchedules(schedules)}`;
    }

    private async listInstructors(): Promise<string> {
        const instructors = await this.schedulesService.getDistinctInstructors();
        if (instructors.length === 0) return 'No instructors found.';
        return `👨‍🏫 *Instructors*\n\n${instructors.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}`;
    }

    private async listRooms(): Promise<string> {
        const rooms = await this.schedulesService.getDistinctRooms();
        if (rooms.length === 0) return 'No rooms found.';
        return `🏫 *Rooms*\n\n${rooms.map((r, idx) => `${idx + 1}. ${r}`).join('\n')}`;
    }

    private async listPrograms(): Promise<string> {
        const programs = await this.schedulesService.getDistinctPrograms();
        if (programs.length === 0) return 'No programs found.';
        return `📚 *Programs*\n\n${programs.map((p, idx) => `${idx + 1}. ${p}`).join('\n')}`;
    }

    private formatSchedules(schedules: Schedule[]): string {
        const grouped = new Map<string, Schedule[]>();
        for (const s of schedules) {
            const key = s.day;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(s);
        }

        const lines: string[] = [];
        for (const [day, items] of grouped) {
            lines.push(`*${day}*`);
            for (const s of items) {
                lines.push(
                    `  ⏰ ${s.startTime} - ${s.endTime}`,
                    `  📖 ${s.moduleCode} - ${s.moduleTitle}`,
                    `  👤 ${s.instructor}`,
                    `  🏫 ${s.room} | ${s.program} ${s.section}`,
                    `  📝 ${s.classType} | Group: ${s.group}`,
                    '',
                );
            }
        }

        return lines.join('\n');
    }

    private extractNameAndDay(input: string): { name: string; day?: string } {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
            'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const words = input.split(/\s+/);
        const lastWord = words[words.length - 1]?.toLowerCase();

        if (words.length > 1 && days.includes(lastWord)) {
            const day = this.parseDay(lastWord);
            const name = words.slice(0, -1).join(' ');
            return { name, day: day || undefined };
        }
        return { name: input };
    }

    private parseDay(input: string): string | null {
        const days: Record<string, string> = {
            sun: 'Sunday', sunday: 'Sunday',
            mon: 'Monday', monday: 'Monday',
            tue: 'Tuesday', tuesday: 'Tuesday',
            wed: 'Wednesday', wednesday: 'Wednesday',
            thu: 'Thursday', thursday: 'Thursday',
            fri: 'Friday', friday: 'Friday',
            sat: 'Saturday', saturday: 'Saturday',
        };
        return days[input.toLowerCase()] || null;
    }

    private splitMessage(message: string, maxLength: number): string[] {
        if (message.length <= maxLength) return [message];

        const chunks: string[] = [];
        const lines = message.split('\n');
        let current = '';

        for (const line of lines) {
            if (current.length + line.length + 1 > maxLength) {
                if (current) chunks.push(current);
                current = line;
            } else {
                current = current ? `${current}\n${line}` : line;
            }
        }
        if (current) chunks.push(current);
        return chunks;
    }
}
