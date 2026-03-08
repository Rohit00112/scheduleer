import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('schedules')
export class Schedule {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    day: string;

    @Column()
    startTime: string;

    @Column()
    endTime: string;

    @Column()
    classType: string;

    @Column()
    year: number;

    @Column()
    moduleCode: string;

    @Column()
    moduleTitle: string;

    @Column()
    instructor: string;

    @Column()
    group: string;

    @Column()
    block: string;

    @Column()
    level: number;

    @Column()
    room: string;

    @Column()
    program: string;

    @Column()
    section: string;

    @Column({ type: 'float', nullable: true, default: 1.5 })
    hours: number;

    @Column({ nullable: true })
    specialization: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
