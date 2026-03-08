import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Announcement } from '../../entities/announcement.entity';

@Injectable()
export class AnnouncementsService {
    constructor(
        @InjectRepository(Announcement)
        private readonly announcementRepo: Repository<Announcement>,
    ) { }

    async findAll() {
        return this.announcementRepo.find({ order: { createdAt: 'DESC' } });
    }

    async findActive() {
        return this.announcementRepo.find({
            where: { active: true },
            order: { createdAt: 'DESC' },
        });
    }

    async create(data: { title: string; message: string; type?: string; createdBy: string }) {
        const announcement = this.announcementRepo.create(data);
        return this.announcementRepo.save(announcement);
    }

    async remove(id: number) {
        const item = await this.announcementRepo.findOne({ where: { id } });
        if (!item) throw new NotFoundException();
        return this.announcementRepo.remove(item);
    }

    async toggleActive(id: number) {
        const item = await this.announcementRepo.findOne({ where: { id } });
        if (!item) throw new NotFoundException();
        item.active = !item.active;
        return this.announcementRepo.save(item);
    }
}
