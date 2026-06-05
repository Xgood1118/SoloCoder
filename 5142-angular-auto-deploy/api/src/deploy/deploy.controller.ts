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
import { DeployService } from './deploy.service';
import { CreateDeployRequestDto } from './dto/create-deploy-request.dto';
import { ApprovalDto } from './dto/approval.dto';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@Controller('deployments')
@UseGuards(RolesGuard)
export class DeployController {
  constructor(private deployService: DeployService) {}

  @Post()
  async create(
    @Body() dto: CreateDeployRequestDto,
    @Session() session: Record<string, any>,
  ) {
    return this.deployService.create(dto, session.user.id);
  }

  @Get()
  async findAll(@Session() session: Record<string, any>) {
    return this.deployService.findAll(session.user.id, session.user.role);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.deployService.findOne(id);
  }

  @Post(':id/submit')
  async submitForApproval(
    @Param('id') id: string,
    @Session() session: Record<string, any>,
  ) {
    return this.deployService.submitForApproval(id, session.user.id, session.user.role);
  }

  @Post(':id/approve')
  @Roles('admin', 'approver')
  async approve(
    @Param('id') id: string,
    @Body() approvalDto: ApprovalDto,
    @Session() session: Record<string, any>,
  ) {
    return this.deployService.approve(id, approvalDto, session.user.id, session.user.role);
  }

  @Post(':id/execute')
  @Roles('admin')
  async executeDeploy(@Param('id') id: string) {
    return this.deployService.executeDeploy(id);
  }

  @Post(':id/complete')
  @Roles('admin')
  async completeDeploy(
    @Param('id') id: string,
    @Body() body: { success: boolean },
  ) {
    return this.deployService.completeDeploy(id, body.success);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Session() session: Record<string, any>,
  ) {
    return this.deployService.remove(id, session.user.id, session.user.role);
  }
}
