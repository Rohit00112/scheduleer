import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('announcements')
export class Announcement {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ type: 'text' })
    message: string;

    @Column({ default: 'info' })
    type: string; // 'info' | 'warning' | 'urgent'

    @Column()
    createdBy: string;

    @Column({ default: true })
    active: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
