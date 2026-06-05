import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Session,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RolesGuard } from '../common/roles.guard';

@Controller('auth')
@UseGuards(RolesGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Session() session: Record<string, any>,
  ) {
    const user = await this.authService.login(loginDto.username, loginDto.password);
    session.user = user;
    return { message: 'Login successful', user };
  }

  @Post('logout')
  async logout(@Session() session: Record<string, any>) {
    session.user = null;
    return { message: 'Logout successful' };
  }

  @Get('users')
  async getUsers() {
    return this.authService.getAllUsers();
  }

  @Get('session')
  async getSession(@Session() session: Record<string, any>) {
    if (!session.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    const user = await this.authService.getSessionUser(session.user.id);
    if (!user) {
      session.user = null;
      throw new UnauthorizedException('User not found');
    }
    return { user: session.user };
  }
}
