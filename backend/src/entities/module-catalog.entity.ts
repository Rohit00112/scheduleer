import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('module_catalog')
export class ModuleCatalog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    code: string;

    @Column()
    title: string;

    @CreateDateColumn()
    createdAt: Date;
}
