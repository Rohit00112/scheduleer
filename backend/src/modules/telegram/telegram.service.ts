import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulesService } from '../schedules/schedules.service';
import { Schedule } from '../../entities/schedule.entity';
import { Telegraf } from 'telegraf';

@Injectable()
export class TelegramService implements OnModuleInit {
    private readonly logger = new Logger(TelegramService.name);
    private bot: Telegraf | null = null;
    private userPrefs = new Map<number, { instructor?: string }>();

    constructor(private readonly schedulesService: SchedulesService) { }

    onModuleInit() {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) {
            this.logger.warn('TELEGRAM_BOT_TOKEN not set. Telegram bot will not start.');
            return;
        }

        this.bot = new Telegraf(token);
        this.registerCommands();
        this.bot.launch().then(() => {
            this.logger.log('Telegram bot started');
        });
    }

    private registerCommands() {
        if (!this.bot) return;

        this.bot.command('start', (ctx) => ctx.reply(this.getHelpMessage(), { parse_mode: 'Markdown' }));
        this.bot.command('help', (ctx) => ctx.reply(this.getHelpMessage(), { parse_mode: 'Markdown' }));

        this.bot.command('setinstructor', async (ctx) => {
            const input = ctx.message.text.replace(/^\/setinstructor\s*/i, '').trim();
            if (!input) {
                await ctx.reply('Usage: /setinstructor Sujan Subedi');
                return;
            }
            this.userPrefs.set(ctx.from.id, { ...this.userPrefs.get(ctx.from.id), instructor: input });
            await ctx.reply(`✅ Saved! I'll remember *${input}* as your instructor.\nNow /today and /day will show only their schedule.`, { parse_mode: 'Markdown' });
        });

        this.bot.command('myinstructor', async (ctx) => {
            const prefs = this.userPrefs.get(ctx.from.id);
            if (prefs?.instructor) {
                await ctx.reply(`Your saved instructor: *${prefs.instructor}*`, { parse_mode: 'Markdown' });
            } else {
                await ctx.reply('No instructor saved. Use /setinstructor <name> to set one.');
            }
        });

        this.bot.command('clear', async (ctx) => {
            this.userPrefs.delete(ctx.from.id);
            await ctx.reply('✅ Preferences cleared. /today will now show the full schedule.');
        });

        this.bot.command('today', async (ctx) => {
            const query = ctx.message.text.replace(/^\/today\s*/i, '').trim();
            const savedInstructor = this.userPrefs.get(ctx.from.id)?.instructor;
            const day = this.getTodayName();
            const reply = await this.getFilteredSchedule(day, query || savedInstructor);
            await this.sendLongMessage(ctx, reply);
        });

        this.bot.command('day', async (ctx) => {
            const input = ctx.message.text.replace(/^\/day\s*/i, '').trim();
            if (!input) {
                await ctx.reply('Usage: /day monday or /day monday sujan subedi');
                return;
            }
            const words = input.split(/\s+/);
            const day = this.parseDay(words[0]);
            if (!day) {
                await ctx.reply('Invalid day. Try: sun, mon, tue, wed, thu, fri, sat');
                return;
            }
            const query = words.slice(1).join(' ').trim();
            const savedInstructor = this.userPrefs.get(ctx.from.id)?.instructor;
            const reply = await this.getFilteredSchedule(day, query || savedInstructor);
            await this.sendLongMessage(ctx, reply);
        });

        this.bot.on('text', async (ctx) => {
            await ctx.reply(this.getHelpMessage(), { parse_mode: 'Markdown' });
        });
    }

    private async sendLongMessage(ctx: any, text: string): Promise<void> {
        const chunks = this.splitMessage(text, 4000);
        for (const chunk of chunks) {
            try {
                await ctx.reply(chunk, { parse_mode: 'Markdown' });
            } catch {
                // Fallback without markdown if parsing fails
                await ctx.reply(chunk);
            }
        }
    }

    private getHelpMessage(): string {
        return [
            '📅 *Schedule Bot*',
            '',
            '/today - Today\'s schedule',
            '/today sujan subedi - Today by instructor',
            '/today L2C2 - Today by section/room/group',
            '/day monday - Schedule for a day',
            '/day monday L2C2 - Day + filter',
            '/setinstructor Name - Save default filter',
            '/clear - Reset saved filter',
            '/help - Show commands',
        ].join('\n');
    }

    private async getFilteredSchedule(day: string, query?: string): Promise<string> {
        const schedules = await this.schedulesService.findAll({ day });
        if (schedules.length === 0) return `No classes scheduled for ${day}.`;

        if (!query) {
            return `📅 *${day}'s Schedule*\n\n${this.formatSchedules(schedules)}`;
        }

        const q = query.toLowerCase();
        const filtered = schedules.filter(
            (s) =>
                s.instructor.toLowerCase().includes(q) ||
                s.section.toLowerCase().includes(q) ||
                s.room.toLowerCase().includes(q) ||
                s.program.toLowerCase().includes(q) ||
                s.group.toLowerCase().includes(q) ||
                s.moduleCode.toLowerCase().includes(q) ||
                s.moduleTitle.toLowerCase().includes(q),
        );

        if (filtered.length === 0) return `No results for "${query}" on ${day}.`;
        return `📅 *${day} — ${query}*\n\n${this.formatSchedules(filtered)}`;
    }

    private getTodayName(): string {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[new Date().getDay()];
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
