import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from '../../entities/room.entity';
import { Schedule } from '../../entities/schedule.entity';

@Injectable()
export class RoomsService {
    constructor(
        @InjectRepository(Room)
        private readonly roomRepo: Repository<Room>,
        @InjectRepository(Schedule)
        private readonly scheduleRepo: Repository<Schedule>,
    ) { }

    async findAll(): Promise<Room[]> {
        return this.roomRepo.find({ order: { block: 'ASC', level: 'ASC', name: 'ASC' } });
    }

    async findOne(id: number): Promise<Room> {
        const room = await this.roomRepo.findOne({ where: { id } });
        if (!room) throw new NotFoundException(`Room #${id} not found`);
        return room;
    }

    async create(data: Partial<Room>): Promise<Room> {
        const room = this.roomRepo.create(data);
        return this.roomRepo.save(room);
    }

    async upsertByName(data: Partial<Room>): Promise<Room> {
        const existing = await this.roomRepo.findOne({ where: { name: data.name } });
        if (existing) {
            Object.assign(existing, data);
            return this.roomRepo.save(existing);
        }
        return this.create(data);
    }

    async bulkUpsert(rooms: Partial<Room>[]): Promise<number> {
        let count = 0;
        for (const r of rooms) {
            await this.upsertByName(r);
            count++;
        }
        return count;
    }

    async getUtilization(): Promise<{
        rooms: {
            id: number;
            name: string;
            capacity: number | null;
            block: string;
            level: string;
            furnitureType: string | null;
            occupiedSlots: number;
            totalSlots: number;
            utilizationPct: number;
            classCounts: { lectures: number; tutorials: number; workshops: number };
        }[];
        heatmap: Record<string, number>;
        summary: {
            totalRooms: number;
            avgUtilization: number;
            underUsed: number;
            overUsed: number;
            totalCapacity: number;
        };
    }> {
        const allRooms = await this.roomRepo.find({ order: { name: 'ASC' } });
        const schedules = await this.scheduleRepo.find();

        const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        const HOURS = [8, 9, 10, 11, 12, 13, 14, 15];
        const totalSlots = DAYS.length * HOURS.length;

        const roomOccupancy = new Map<string, Set<string>>();
        const roomClassCounts = new Map<string, { lectures: number; tutorials: number; workshops: number }>();

        for (const s of schedules) {
            if (!s.room) continue;
            const set = roomOccupancy.get(s.room) || new Set<string>();
            const startH = this.timeToHour(s.startTime);
            const endH = this.timeToHour(s.endTime);
            for (let h = startH; h < endH; h++) {
                set.add(`${s.day}-${h}`);
            }
            roomOccupancy.set(s.room, set);

            const counts = roomClassCounts.get(s.room) || { lectures: 0, tutorials: 0, workshops: 0 };
            if (s.classType === 'Lecture') counts.lectures++;
            else if (s.classType === 'Tutorial') counts.tutorials++;
            else if (s.classType === 'Workshop') counts.workshops++;
            roomClassCounts.set(s.room, counts);
        }

        // Build heatmap
        const heatmap: Record<string, number> = {};
        for (const day of DAYS) {
            for (const hour of HOURS) {
                const key = `${day}-${hour}`;
                let count = 0;
                roomOccupancy.forEach((slots) => { if (slots.has(key)) count++; });
                heatmap[key] = count;
            }
        }

        // Build per-room stats
        const roomStats = allRooms.map((room) => {
            const occupied = roomOccupancy.get(room.name)?.size || 0;
            const utilizationPct = totalSlots > 0 ? (occupied / totalSlots) * 100 : 0;
            return {
                id: room.id,
                name: room.name,
                capacity: room.capacity,
                block: room.block,
                level: room.level,
                furnitureType: room.furnitureType,
                occupiedSlots: occupied,
                totalSlots,
                utilizationPct,
                classCounts: roomClassCounts.get(room.name) || { lectures: 0, tutorials: 0, workshops: 0 },
            };
        });

        // Also add rooms from schedules not in Room table
        const knownRoomNames = new Set(allRooms.map((r) => r.name));
        for (const [roomName, slots] of roomOccupancy.entries()) {
            if (!knownRoomNames.has(roomName)) {
                roomStats.push({
                    id: 0,
                    name: roomName,
                    capacity: null as number | null,
                    block: '',
                    level: '',
                    furnitureType: null as string | null,
                    occupiedSlots: slots.size,
                    totalSlots,
                    utilizationPct: totalSlots > 0 ? (slots.size / totalSlots) * 100 : 0,
                    classCounts: roomClassCounts.get(roomName) || { lectures: 0, tutorials: 0, workshops: 0 },
                });
            }
        }

        roomStats.sort((a, b) => b.utilizationPct - a.utilizationPct);

        const avgUtil = roomStats.length ? roomStats.reduce((s, r) => s + r.utilizationPct, 0) / roomStats.length : 0;

        return {
            rooms: roomStats,
            heatmap,
            summary: {
                totalRooms: roomStats.length,
                avgUtilization: avgUtil,
                underUsed: roomStats.filter((r) => r.utilizationPct < 20).length,
                overUsed: roomStats.filter((r) => r.utilizationPct > 60).length,
                totalCapacity: allRooms.reduce((s, r) => s + (r.capacity || 0), 0),
            },
        };
    }

    private timeToHour(time: string): number {
        const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (!match) return 0;
        let h = parseInt(match[1]);
        const period = match[3]?.toUpperCase();
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return h;
    }
}
