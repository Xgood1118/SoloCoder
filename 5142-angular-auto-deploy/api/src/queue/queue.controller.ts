import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { CreateQueueItemDto } from './dto/create-queue-item.dto';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@Controller('queue')
@UseGuards(RolesGuard)
export class QueueController {
  constructor(private queueService: QueueService) {}

  @Post()
  async enqueue(@Body() dto: CreateQueueItemDto) {
    return this.queueService.enqueue(dto);
  }

  @Get()
  async findAll() {
    return this.queueService.findAll();
  }

  @Get('graph')
  async getDependencyGraph() {
    return this.queueService.getDependencyGraph();
  }

  @Get('cycle-check')
  @Roles('admin')
  async checkCycle() {
    return this.queueService.checkCycle();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.queueService.findOne(id);
  }

  @Post('process-next')
  @Roles('admin')
  async processNext() {
    const item = await this.queueService.processNext();
    if (!item) {
      return { message: 'No ready items in queue' };
    }
    return item;
  }

  @Post(':id/complete')
  @Roles('admin')
  async completeItem(
    @Param('id') id: string,
    @Body() body: { success: boolean },
  ) {
    return this.queueService.completeItem(id, body.success);
  }

  @Post(':id/cancel')
  @Roles('admin')
  async cancelItem(@Param('id') id: string) {
    return this.queueService.cancelItem(id);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string) {
    return this.queueService.remove(id);
  }
}
