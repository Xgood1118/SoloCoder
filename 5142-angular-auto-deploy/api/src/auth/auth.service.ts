import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User, UserRole } from '../entities';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  async login(username: string, password: string): Promise<{ id: string; username: string; role: UserRole }> {
    const user = await this.userRepo.findOne({ where: { username } });
    if (!user || !user.active) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (user.password !== this.hashPassword(password)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { id: user.id, username: user.username, role: user.role };
  }

  async getSessionUser(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async getAllUsers(): Promise<{ id: string; username: string; role: UserRole; active: boolean; createdAt: string }[]> {
    const users = await this.userRepo.find();
    return users.map((u) => ({ id: u.id, username: u.username, role: u.role, active: u.active, createdAt: String(u.createdAt) }));
  }
}
