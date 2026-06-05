import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  RollbackRequest,
  RollbackStatus,
  DeployRequest,
  DeployStatus,
  UserRole,
} from '../entities';
import { CreateRollbackRequestDto } from './dto/create-rollback-request.dto';

@Injectable()
export class RollbackService {
  constructor(
    @InjectRepository(RollbackRequest)
    private rollbackRepo: Repository<RollbackRequest>,
    @InjectRepository(DeployRequest)
    private deployRepo: Repository<DeployRequest>,
    private dataSource: DataSource,
  ) {}

  async create(dto: CreateRollbackRequestDto, userId: string): Promise<RollbackRequest> {
    const deployRequest = await this.deployRepo.findOne({
      where: { id: dto.deployRequestId },
    });
    if (!deployRequest) {
      throw new NotFoundException('Deploy request not found');
    }
    if (deployRequest.status !== DeployStatus.DEPLOYED) {
      throw new BadRequestException('Can only rollback deployed requests');
    }

    const request = this.rollbackRepo.create({
      ...dto,
      userId,
      status: RollbackStatus.PENDING,
    });
    return this.rollbackRepo.save(request);
  }

  async findAll(userId: string, role: UserRole): Promise<RollbackRequest[]> {
    if (role === UserRole.ADMIN) {
      return this.rollbackRepo.find({
        order: { createdAt: 'DESC' },
        relations: ['deployRequest', 'user'],
      });
    }
    return this.rollbackRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['deployRequest', 'user'],
    });
  }

  async findOne(id: string): Promise<RollbackRequest> {
    const request = await this.rollbackRepo.findOne({
      where: { id },
      relations: ['deployRequest', 'user'],
    });
    if (!request) {
      throw new NotFoundException('Rollback request not found');
    }
    return request;
  }

  async approve(id: string, role: UserRole): Promise<RollbackRequest> {
    if (role !== UserRole.ADMIN && role !== UserRole.APPROVER) {
      throw new ForbiddenException('Only admin or approver can approve rollback');
    }
    const request = await this.findOne(id);
    if (request.status !== RollbackStatus.PENDING) {
      throw new BadRequestException('Only pending rollback requests can be approved');
    }
    request.status = RollbackStatus.APPROVED;
    return this.rollbackRepo.save(request);
  }

  async reject(id: string, role: UserRole): Promise<RollbackRequest> {
    if (role !== UserRole.ADMIN && role !== UserRole.APPROVER) {
      throw new ForbiddenException('Only admin or approver can reject rollback');
    }
    const request = await this.findOne(id);
    if (request.status !== RollbackStatus.PENDING) {
      throw new BadRequestException('Only pending rollback requests can be rejected');
    }
    request.status = RollbackStatus.REJECTED;
    return this.rollbackRepo.save(request);
  }

  async executeRollback(id: string): Promise<RollbackRequest> {
    return this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(RollbackRequest, {
        where: { id },
        relations: ['deployRequest'],
      });
      if (!request) {
        throw new NotFoundException('Rollback request not found');
      }
      if (request.status !== RollbackStatus.APPROVED) {
        throw new BadRequestException('Only approved rollback requests can be executed');
      }

      request.status = RollbackStatus.RUNNING;
      await manager.save(request);

      try {
        const deployRequest = request.deployRequest;
        deployRequest.status = DeployStatus.ROLLED_BACK;
        await manager.save(deployRequest);

        request.status = RollbackStatus.COMPLETED;
        await manager.save(request);
      } catch (error) {
        request.status = RollbackStatus.FAILED;
        request.errorMessage = error.message;
        await manager.save(request);
      }

      return request;
    });
  }

  async remove(id: string, userId: string, role: UserRole): Promise<void> {
    const request = await this.findOne(id);
    if (role !== UserRole.ADMIN && request.userId !== userId) {
      throw new ForbiddenException('Cannot delete this rollback request');
    }
    if (request.status === RollbackStatus.RUNNING) {
      throw new BadRequestException('Cannot delete a running rollback request');
    }
    await this.rollbackRepo.remove(request);
  }
}
