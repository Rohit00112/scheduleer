import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';

@Entity('rooms')
export class Room {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    name: string;

    @Column({ type: 'integer', nullable: true })
    capacity: number | null;

    @Column({ type: 'varchar', default: '' })
    block: string;

    @Column({ type: 'varchar', default: '' })
    level: string;

    @Column({ type: 'varchar', nullable: true })
    furnitureType: string | null;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
