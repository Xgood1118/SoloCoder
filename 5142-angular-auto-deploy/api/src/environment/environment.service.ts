import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Environment } from '../entities';
import { CreateEnvironmentDto, UpdateEnvironmentDto } from './dto/environment.dto';
import { EncryptionService } from '../common/encryption.service';

@Injectable()
export class EnvironmentService {
  constructor(
    @InjectRepository(Environment)
    private envRepo: Repository<Environment>,
    private encryptionService: EncryptionService,
  ) {}

  async create(dto: CreateEnvironmentDto): Promise<Environment> {
    const env = this.envRepo.create(dto);
    if (dto.credentials) {
      env.credentials = this.encryptionService.encrypt(dto.credentials);
    }
    return this.envRepo.save(env);
  }

  async findAll(): Promise<Environment[]> {
    return this.envRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Environment> {
    const env = await this.envRepo.findOne({ where: { id } });
    if (!env) {
      throw new NotFoundException('Environment not found');
    }
    return env;
  }

  async update(id: string, dto: UpdateEnvironmentDto): Promise<Environment> {
    const env = await this.findOne(id);
    if (dto.credentials !== undefined) {
      dto.credentials = dto.credentials
        ? this.encryptionService.encrypt(dto.credentials)
        : undefined;
    }
    Object.assign(env, dto);
    return this.envRepo.save(env);
  }

  async remove(id: string): Promise<void> {
    const env = await this.findOne(id);
    await this.envRepo.remove(env);
  }

  async toggleEnabled(id: string): Promise<Environment> {
    const env = await this.findOne(id);
    env.enabled = !env.enabled;
    return this.envRepo.save(env);
  }

  async getDecryptedCredentials(id: string): Promise<string | null> {
    const env = await this.findOne(id);
    if (!env.credentials) {
      return null;
    }
    return this.encryptionService.decrypt(env.credentials);
  }
}
