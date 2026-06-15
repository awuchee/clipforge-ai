import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/auth.service';
import { ClipsService } from './clips.service';
import { UpdateClipDto } from './dto/update-clip.dto';

@UseGuards(JwtAuthGuard)
@Controller('clips')
export class ClipsController {
  constructor(private clipsService: ClipsService) {}

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: SafeUser) {
    return this.clipsService.findOneForUser(id, user.id);
  }

  @Get(':id/metadata')
  getMetadata(@Param('id') id: string, @CurrentUser() user: SafeUser) {
    return this.clipsService.getMetadata(id, user.id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClipDto, @CurrentUser() user: SafeUser) {
    return this.clipsService.update(id, user.id, dto);
  }

  @Post(':id/regenerate-hooks')
  regenerateHooks(@Param('id') id: string, @CurrentUser() user: SafeUser) {
    return this.clipsService.regenerateHooks(id, user.id);
  }
}
