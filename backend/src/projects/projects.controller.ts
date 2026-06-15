import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/auth.service';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';

@UseGuards(JwtAuthGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get()
  findAll(@CurrentUser() user: SafeUser) {
    return this.projectsService.findAllForUser(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: SafeUser) {
    return this.projectsService.findOneForUser(id, user.id);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string, @CurrentUser() user: SafeUser) {
    return this.projectsService.getStatus(id, user.id);
  }

  @Get(':id/clips')
  getClips(@Param('id') id: string, @CurrentUser() user: SafeUser) {
    return this.projectsService.getClips(id, user.id);
  }

  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser() user: SafeUser) {
    return this.projectsService.create(user.id, dto);
  }

  @Post(':id/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize:
          parseInt(process.env.MAX_UPLOAD_SIZE_MB ?? '2048', 10) * 1024 * 1024,
      },
    }),
  )
  upload(
    @Param('id') id: string,
    @CurrentUser() user: SafeUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    return this.projectsService.attachUpload(id, user.id, file);
  }
}
