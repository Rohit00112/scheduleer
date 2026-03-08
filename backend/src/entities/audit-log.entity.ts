import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    action: string; // 'create' | 'update' | 'delete'

    @Column()
    entityType: string; // 'schedule' | 'user'

    @Column({ nullable: true })
    entityId: number;

    @Column()
    username: string;

    @Column({ type: 'text', nullable: true })
    oldValues: string; // JSON string

    @Column({ type: 'text', nullable: true })
    newValues: string; // JSON string

    @Column({ nullable: true })
    description: string;

    @CreateDateColumn()
    createdAt: Date;
}
