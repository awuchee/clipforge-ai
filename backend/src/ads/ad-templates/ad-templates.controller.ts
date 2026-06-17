import { Controller, Get, NotFoundException, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdTemplatesService } from './ad-templates.service';
import { AdPlatform } from './ad-templates.constants';

@UseGuards(JwtAuthGuard)
@Controller('ads/templates')
export class AdTemplatesController {
  constructor(private adTemplates: AdTemplatesService) {}

  @Get()
  findAll(@Query('platform') platform?: AdPlatform) {
    return this.adTemplates.findAll(platform);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const template = this.adTemplates.findOne(id);
    if (!template) {
      throw new NotFoundException(`Ad template ${id} not found`);
    }
    return template;
  }
}
