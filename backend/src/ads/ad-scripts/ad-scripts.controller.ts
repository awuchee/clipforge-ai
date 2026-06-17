import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { SafeUser } from '../../auth/auth.service';
import { AdScriptsService } from './ad-scripts.service';
import { GenerateAdScriptDto } from './dto/generate-ad-script.dto';

@UseGuards(JwtAuthGuard)
@Controller('ads/scripts')
export class AdScriptsController {
  constructor(private adScripts: AdScriptsService) {}

  @Post('generate')
  generate(@Body() dto: GenerateAdScriptDto, @CurrentUser() user: SafeUser) {
    return this.adScripts.generate(user.id, dto);
  }
}
