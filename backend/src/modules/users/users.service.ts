import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../entities/user.entity';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
    ) { }

    async findAll() {
        const users = await this.userRepo.find({ order: { id: 'ASC' } });
        return users.map(({ password, ...rest }) => rest);
    }

    async create(username: string, password: string, role: UserRole = UserRole.USER, instructorName?: string) {
        const existing = await this.userRepo.findOne({ where: { username } });
        if (existing) throw new ConflictException('Username already exists');

        const hashed = await bcrypt.hash(password, 10);
        const user = this.userRepo.create({
            username,
            password: hashed,
            role,
            mustChangePassword: role === UserRole.INSTRUCTOR,
            instructorName: instructorName || null,
        });
        const saved = await this.userRepo.save(user);
        const { password: _, ...result } = saved;
        return result;
    }

    async updateRole(id: number, role: UserRole) {
        const user = await this.userRepo.findOne({ where: { id } });
        if (!user) throw new NotFoundException();
        user.role = role;
        const saved = await this.userRepo.save(user);
        const { password: _, ...result } = saved;
        return result;
    }

    async resetPassword(id: number, newPassword: string) {
        const user = await this.userRepo.findOne({ where: { id } });
        if (!user) throw new NotFoundException();
        user.password = await bcrypt.hash(newPassword, 10);
        await this.userRepo.save(user);
        return { success: true };
    }

    async remove(id: number) {
        const user = await this.userRepo.findOne({ where: { id } });
        if (!user) throw new NotFoundException();
        await this.userRepo.remove(user);
        return { success: true };
    }
}
