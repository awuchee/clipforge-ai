import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/auth.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  @Get('me')
  me(@CurrentUser() user: SafeUser) {
    return user;
  }
}
