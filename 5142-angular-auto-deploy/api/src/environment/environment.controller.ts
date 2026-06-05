import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { EnvironmentService } from './environment.service';
import { CreateEnvironmentDto, UpdateEnvironmentDto } from './dto/environment.dto';
import { RolesGuard } from '../common/roles.guard';
import { Roles } from '../common/roles.decorator';

@Controller('environments')
@UseGuards(RolesGuard)
export class EnvironmentController {
  constructor(private envService: EnvironmentService) {}

  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateEnvironmentDto) {
    return this.envService.create(dto);
  }

  @Get()
  async findAll() {
    return this.envService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.envService.findOne(id);
  }

  @Put(':id')
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateEnvironmentDto) {
    return this.envService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id') id: string) {
    return this.envService.remove(id);
  }

  @Post(':id/toggle')
  @Roles('admin')
  async toggleEnabled(@Param('id') id: string) {
    return this.envService.toggleEnabled(id);
  }

  @Get(':id/credentials')
  @Roles('admin')
  async getCredentials(@Param('id') id: string) {
    const credentials = await this.envService.getDecryptedCredentials(id);
    return { credentials };
  }
}
