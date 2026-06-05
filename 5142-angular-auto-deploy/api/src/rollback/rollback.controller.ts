import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Session,
  UseGuards,
} from '@nestjs/common';
import { RollbackService } from './rollback.service';
import { CreateRollbackRequestDto } from './dto/create-rollback-request.dto';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@Controller('rollbacks')
@UseGuards(RolesGuard)
export class RollbackController {
  constructor(private rollbackService: RollbackService) {}

  @Post()
  async create(
    @Body() dto: CreateRollbackRequestDto,
    @Session() session: Record<string, any>,
  ) {
    return this.rollbackService.create(dto, session.user.id);
  }

  @Get()
  async findAll(@Session() session: Record<string, any>) {
    return this.rollbackService.findAll(session.user.id, session.user.role);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.rollbackService.findOne(id);
  }

  @Post(':id/approve')
  @Roles('admin', 'approver')
  async approve(@Param('id') id: string, @Session() session: Record<string, any>) {
    return this.rollbackService.approve(id, session.user.role);
  }

  @Post(':id/reject')
  @Roles('admin', 'approver')
  async reject(@Param('id') id: string, @Session() session: Record<string, any>) {
    return this.rollbackService.reject(id, session.user.role);
  }

  @Post(':id/execute')
  @Roles('admin')
  async executeRollback(@Param('id') id: string) {
    return this.rollbackService.executeRollback(id);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Session() session: Record<string, any>,
  ) {
    return this.rollbackService.remove(id, session.user.id, session.user.role);
  }
}
