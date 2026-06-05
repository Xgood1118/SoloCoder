import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  DeployRequest,
  DeployStatus,
  ApprovalNode,
  ApprovalStatus,
  UserRole,
  QueueItem,
  QueueStatus,
} from '../entities';
import { CreateDeployRequestDto } from './dto/create-deploy-request.dto';
import { ApprovalDto } from './dto/approval.dto';

@Injectable()
export class DeployService {
  constructor(
    @InjectRepository(DeployRequest)
    private deployRepo: Repository<DeployRequest>,
    @InjectRepository(ApprovalNode)
    private approvalRepo: Repository<ApprovalNode>,
    @InjectRepository(QueueItem)
    private queueRepo: Repository<QueueItem>,
    private dataSource: DataSource,
  ) {}

  async create(dto: CreateDeployRequestDto, userId: string): Promise<DeployRequest> {
    return this.dataSource.transaction(async (manager) => {
      const request = manager.create(DeployRequest, {
        ...dto,
        userId,
        status: DeployStatus.PENDING,
      });
      const saved = await manager.save(request);

      const approvalNode = manager.create(ApprovalNode, {
        deployRequestId: saved.id,
        approverId: undefined,
        status: ApprovalStatus.PENDING,
        order: 0,
      });
      await manager.save(approvalNode);

      const queueItem = manager.create(QueueItem, {
        deployRequestId: saved.id,
        dependencyIds: [],
        priority: 0,
        status: QueueStatus.READY,
      });
      await manager.save(queueItem);

      return saved;
    });
  }

  async findAll(userId: string, role: UserRole): Promise<DeployRequest[]> {
    if (role === UserRole.ADMIN) {
      return this.deployRepo.find({
        order: { createdAt: 'DESC' },
        relations: ['buildTask', 'environment', 'user', 'approvalNodes'],
      });
    }
    return this.deployRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      relations: ['buildTask', 'environment', 'user', 'approvalNodes'],
    });
  }

  async findOne(id: string): Promise<DeployRequest> {
    const request = await this.deployRepo.findOne({
      where: { id },
      relations: ['buildTask', 'environment', 'user', 'approvalNodes', 'approvalNodes.approver'],
    });
    if (!request) {
      throw new NotFoundException('Deploy request not found');
    }
    return request;
  }

  async submitForApproval(id: string, userId: string, role: UserRole): Promise<DeployRequest> {
    const request = await this.findOne(id);
    if (role !== UserRole.ADMIN && request.userId !== userId) {
      throw new ForbiddenException('Cannot submit this deploy request');
    }
    if (request.status !== DeployStatus.PENDING) {
      throw new BadRequestException('Only pending requests can be submitted for approval');
    }

    await this.approvalRepo.update(
      { deployRequestId: id, order: 0 },
      { status: ApprovalStatus.PENDING },
    );

    request.status = DeployStatus.APPROVING;
    return this.deployRepo.save(request);
  }

  async approve(
    id: string,
    approvalDto: ApprovalDto,
    approverId: string,
    role: UserRole,
  ): Promise<DeployRequest> {
    if (role !== UserRole.ADMIN && role !== UserRole.APPROVER) {
      throw new ForbiddenException('Only admin or approver can approve');
    }

    return this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(DeployRequest, {
        where: { id },
        relations: ['approvalNodes'],
      });
      if (!request) {
        throw new NotFoundException('Deploy request not found');
      }
      if (request.status !== DeployStatus.APPROVING) {
        throw new BadRequestException('Request is not in approval state');
      }

      const pendingNode = request.approvalNodes
        .sort((a, b) => a.order - b.order)
        .find((n) => n.status === ApprovalStatus.PENDING);

      if (!pendingNode) {
        throw new BadRequestException('No pending approval nodes');
      }

      pendingNode.status = approvalDto.status;
      pendingNode.comment = approvalDto.comment || '';
      pendingNode.approverId = approverId;
      await manager.save(pendingNode);

      if (approvalDto.status === ApprovalStatus.REJECTED) {
        request.status = DeployStatus.REJECTED;
      } else {
        const hasMorePending = request.approvalNodes.some(
          (n) => n.id !== pendingNode.id && n.status === ApprovalStatus.PENDING,
        );
        if (!hasMorePending) {
          request.status = DeployStatus.APPROVED;
        }
      }

      return manager.save(request);
    });
  }

  async executeDeploy(id: string): Promise<DeployRequest> {
    const request = await this.findOne(id);
    if (request.status !== DeployStatus.APPROVED) {
      throw new BadRequestException('Only approved requests can be deployed');
    }
    request.status = DeployStatus.DEPLOYING;
    return this.deployRepo.save(request);
  }

  async completeDeploy(id: string, success: boolean): Promise<DeployRequest> {
    const request = await this.findOne(id);
    if (request.status !== DeployStatus.DEPLOYING) {
      throw new BadRequestException('Request is not in deploying state');
    }
    request.status = success ? DeployStatus.DEPLOYED : DeployStatus.FAILED;
    return this.deployRepo.save(request);
  }

  async remove(id: string, userId: string, role: UserRole): Promise<void> {
    const request = await this.findOne(id);
    if (role !== UserRole.ADMIN && request.userId !== userId) {
      throw new ForbiddenException('Cannot delete this deploy request');
    }
    if (request.status === DeployStatus.DEPLOYING) {
      throw new BadRequestException('Cannot delete a deploying request');
    }
    await this.deployRepo.remove(request);
  }
}
