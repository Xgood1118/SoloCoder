import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { QueueItem, QueueStatus, DeployRequest } from '../entities';
import { CreateQueueItemDto } from './dto/create-queue-item.dto';

export interface CycleDetectionResult {
  hasCycle: boolean;
  cycleNodes: string[];
}

@Injectable()
export class QueueService {
  constructor(
    @InjectRepository(QueueItem)
    private queueRepo: Repository<QueueItem>,
    @InjectRepository(DeployRequest)
    private deployRepo: Repository<DeployRequest>,
    private dataSource: DataSource,
  ) {}

  async enqueue(dto: CreateQueueItemDto): Promise<QueueItem> {
    const dependencyIds = dto.dependencyIds || [];

    return this.dataSource.transaction(async (manager) => {
      const deployRequest = await manager.findOne(DeployRequest, {
        where: { id: dto.deployRequestId },
      });
      if (!deployRequest) {
        throw new NotFoundException('Deploy request not found');
      }

      const allItems = await manager.find(QueueItem);
      const newId = 'pending-' + Date.now();

      const tempItem = {
        id: newId,
        dependencyIds,
        status: QueueStatus.WAITING,
      };

      const graphItems = [...allItems, tempItem];
      const cycleResult = this.detectCycle(graphItems);
      if (cycleResult.hasCycle) {
        throw new BadRequestException(
          `Dependency cycle detected: ${cycleResult.cycleNodes.join(' -> ')}`,
        );
      }

      const item = manager.create(QueueItem, {
        deployRequestId: dto.deployRequestId,
        dependencyIds,
        priority: dto.priority || 0,
        status: dependencyIds.length === 0 ? QueueStatus.READY : QueueStatus.WAITING,
      });

      return manager.save(item);
    });
  }

  async findAll(): Promise<QueueItem[]> {
    return this.queueRepo.find({
      order: { priority: 'DESC', createdAt: 'ASC' },
      relations: ['deployRequest'],
    });
  }

  async findOne(id: string): Promise<QueueItem> {
    const item = await this.queueRepo.findOne({
      where: { id },
      relations: ['deployRequest'],
    });
    if (!item) {
      throw new NotFoundException('Queue item not found');
    }
    return item;
  }

  async remove(id: string): Promise<void> {
    const item = await this.findOne(id);
    if (item.status === QueueStatus.RUNNING) {
      throw new BadRequestException('Cannot remove a running queue item');
    }
    await this.queueRepo.remove(item);
    await this.updateDependentItems(item.id);
  }

  async processNext(): Promise<QueueItem | null> {
    return this.dataSource.transaction(async (manager) => {
      const readyItems = await manager.find(QueueItem, {
        where: { status: QueueStatus.READY },
        order: { priority: 'DESC', createdAt: 'ASC' },
        take: 1,
      });

      if (readyItems.length === 0) {
        return null;
      }

      const item = readyItems[0];
      item.status = QueueStatus.RUNNING;
      return manager.save(item);
    });
  }

  async completeItem(id: string, success: boolean): Promise<QueueItem> {
    return this.dataSource.transaction(async (manager) => {
      const item = await manager.findOne(QueueItem, { where: { id } });
      if (!item) {
        throw new NotFoundException('Queue item not found');
      }
      if (item.status !== QueueStatus.RUNNING) {
        throw new BadRequestException('Item is not running');
      }

      item.status = success ? QueueStatus.COMPLETED : QueueStatus.FAILED;
      if (!success) {
        item.errorMessage = 'Deploy failed';
        if (item.retryCount < item.maxRetries) {
          item.retryCount += 1;
          item.status = QueueStatus.READY;
          item.errorMessage = `Retrying (${item.retryCount}/${item.maxRetries})`;
        }
      }
      const saved = await manager.save(item);

      if (saved.status === QueueStatus.COMPLETED) {
        await this.updateDependentItemsInTransaction(manager, saved.id);
      }

      return saved;
    });
  }

  async cancelItem(id: string): Promise<QueueItem> {
    const item = await this.findOne(id);
    if (item.status === QueueStatus.COMPLETED || item.status === QueueStatus.CANCELLED) {
      throw new BadRequestException('Cannot cancel this item');
    }
    item.status = QueueStatus.CANCELLED;
    const saved = await this.queueRepo.save(item);
    await this.updateDependentItems(saved.id);
    return saved;
  }

  async getDependencyGraph(): Promise<Record<string, string[]>> {
    const items = await this.queueRepo.find();
    const graph: Record<string, string[]> = {};
    for (const item of items) {
      graph[item.id] = item.dependencyIds || [];
    }
    return graph;
  }

  detectCycle(items: Array<{ id: string; dependencyIds: string[] }>): CycleDetectionResult {
    const inDegree: Record<string, number> = {};
    const adjacency: Record<string, string[]> = {};

    for (const item of items) {
      if (!(item.id in inDegree)) {
        inDegree[item.id] = 0;
      }
      if (!adjacency[item.id]) {
        adjacency[item.id] = [];
      }

      for (const depId of item.dependencyIds || []) {
        if (!adjacency[depId]) {
          adjacency[depId] = [];
        }
        adjacency[depId].push(item.id);
        inDegree[item.id] = (inDegree[item.id] || 0) + 1;
      }
    }

    const queue: string[] = [];
    for (const nodeId of Object.keys(inDegree)) {
      if (inDegree[nodeId] === 0) {
        queue.push(nodeId);
      }
    }

    const visited: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      visited.push(node);

      for (const neighbor of (adjacency[node] || [])) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      }
    }

    const allNodes = Object.keys(inDegree);
    const cycleNodes = allNodes.filter((node) => !visited.includes(node));

    return {
      hasCycle: cycleNodes.length > 0,
      cycleNodes,
    };
  }

  async checkCycle(): Promise<CycleDetectionResult> {
    const items = await this.queueRepo.find();
    return this.detectCycle(items);
  }

  private async updateDependentItems(completedId: string): Promise<void> {
    return this.updateDependentItemsInTransaction(this.queueRepo.manager, completedId);
  }

  private async updateDependentItemsInTransaction(
    manager: any,
    completedId: string,
  ): Promise<void> {
    const allItems = await manager.find(QueueItem, {
      where: { status: QueueStatus.WAITING },
    });

    for (const item of allItems) {
      if (item.dependencyIds && item.dependencyIds.includes(completedId)) {
        const remainingDeps = item.dependencyIds.filter((id) => id !== completedId);
        item.dependencyIds = remainingDeps;

        if (remainingDeps.length === 0) {
          item.status = QueueStatus.READY;
        }
        await manager.save(item);
      }
    }
  }
}
