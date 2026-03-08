import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export enum UserRole {
    ADMIN = 'admin',
    USER = 'user',
    INSTRUCTOR = 'instructor',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    username: string;

    @Column()
    password: string;

    @Column({ type: 'varchar', default: UserRole.USER })
    role: UserRole;

    @Column({ type: 'boolean', default: false })
    mustChangePassword: boolean;

    @Column({ type: 'varchar', nullable: true })
    instructorName: string | null;
}
