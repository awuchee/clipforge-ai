import { Injectable } from '@nestjs/common';
import { AdPlatform, AD_TEMPLATES, listAdTemplates } from './ad-templates.constants';

@Injectable()
export class AdTemplatesService {
  findAll(platform?: AdPlatform) {
    return listAdTemplates(platform);
  }

  findOne(id: string) {
    return AD_TEMPLATES.find((t) => t.id === id) ?? null;
  }
}
