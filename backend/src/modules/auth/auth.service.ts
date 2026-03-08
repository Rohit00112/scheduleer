import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../../entities/user.entity';

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        private readonly jwtService: JwtService,
    ) { }

    async register(username: string, password: string, role: UserRole = UserRole.USER) {
        const existing = await this.userRepo.findOne({ where: { username } });
        if (existing) {
            throw new ConflictException('Username already exists');
        }

        const hashed = await bcrypt.hash(password, 10);
        const user = this.userRepo.create({ username, password: hashed, role });
        await this.userRepo.save(user);

        return this.buildToken(user);
    }

    async login(username: string, password: string) {
        const user = await this.userRepo.findOne({ where: { username } });
        if (!user) {
            throw new UnauthorizedException('Invalid credentials');
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            throw new UnauthorizedException('Invalid credentials');
        }

        return this.buildToken(user);
    }

    async findById(id: number) {
        return this.userRepo.findOne({ where: { id } });
    }

    private buildToken(user: User) {
        const payload = { sub: user.id, username: user.username, role: user.role };
        return {
            accessToken: this.jwtService.sign(payload),
            user: { id: user.id, username: user.username, role: user.role },
        };
    }
}
