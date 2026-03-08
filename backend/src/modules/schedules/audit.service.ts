import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity';

@Injectable()
export class AuditService {
    constructor(
        @InjectRepository(AuditLog)
        private readonly auditRepo: Repository<AuditLog>,
    ) { }

    async log(
        action: string,
        entityType: string,
        entityId: number | null,
        username: string,
        description?: string,
        oldValues?: any,
        newValues?: any,
    ) {
        const entry = this.auditRepo.create({
            action,
            entityType,
            entityId: entityId ?? undefined,
            username,
            description,
            oldValues: oldValues ? JSON.stringify(oldValues) : undefined,
            newValues: newValues ? JSON.stringify(newValues) : undefined,
        });
        return this.auditRepo.save(entry);
    }

    async findAll(limit = 100, offset = 0) {
        return this.auditRepo.find({
            order: { createdAt: 'DESC' },
            take: limit,
            skip: offset,
        });
    }

    async findByEntity(entityType: string, entityId: number) {
        return this.auditRepo.find({
            where: { entityType, entityId },
            order: { createdAt: 'DESC' },
        });
    }
}
