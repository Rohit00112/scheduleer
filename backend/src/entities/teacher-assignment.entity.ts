import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('teacher_assignments')
export class TeacherAssignment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    moduleCode: string;

    @Column({ type: 'varchar', nullable: true })
    classType: string | null; // Lecture, Tutorial, Workshop

    @Column()
    teacher: string;

    @Column({ type: 'varchar', nullable: true })
    block: string | null;

    @CreateDateColumn()
    createdAt: Date;
}
