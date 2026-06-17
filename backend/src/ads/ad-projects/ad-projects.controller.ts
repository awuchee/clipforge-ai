import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/auth.service';
import { AdProjectsService } from './ad-projects.service';
import { CreateAdProjectDto } from './dto/create-ad-project.dto';

@UseGuards(JwtAuthGuard)
@Controller('ads/projects')
export class AdProjectsController {
  constructor(private adProjects: AdProjectsService) {}

  @Post()
  create(@Body() dto: CreateAdProjectDto, @CurrentUser() user: SafeUser) {
    return this.adProjects.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: SafeUser) {
    return this.adProjects.findAllForUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: SafeUser) {
    return this.adProjects.getOneForUser(id, user.id);
  }

  @Post(':id/plan')
  generatePlan(@Param('id') id: string, @CurrentUser() user: SafeUser) {
    return this.adProjects.generatePlan(id, user.id);
  }

  @Post(':id/render')
  render(@Param('id') id: string, @CurrentUser() user: SafeUser) {
    return this.adProjects.enqueueRender(id, user.id);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string, @CurrentUser() user: SafeUser) {
    return this.adProjects.getStatus(id, user.id);
  }
}
