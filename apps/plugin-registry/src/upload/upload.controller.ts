import { getErrorMessage } from '@lib/shared/common';
import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { CreatePluginUploadDto } from './upload.dto';
import { UploadService } from './upload.service';

@Controller('plugins')
@UseGuards(AuthGuard)
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly uploadService: UploadService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPlugin(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: CreatePluginUploadDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    this.logger.log(
      `Uploading plugin: ${uploadDto.name} v${uploadDto.version}`,
    );

    try {
      const result = await this.uploadService.uploadPlugin(file, uploadDto);

      this.logger.log(`Successfully uploaded plugin: ${result.id}`);

      return {
        success: true,
        data: result,
        message: 'Plugin uploaded successfully',
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error,'Unknown upload error') ;
      this.logger.error(`Failed to upload plugin: ${errorMessage}`);
      throw error;
    }
  }

  @Post('validate')
  @UseInterceptors(FileInterceptor('file'))
  async validatePlugin(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    try {
      const validation = await this.uploadService.validatePluginFile(file);

      return {
        success: true,
        data: validation,
        message: 'Plugin validation completed',
      };
    } catch (error) {
      const errorMessage = getErrorMessage(error,'Unknown validation error') ;
      this.logger.error(`Plugin validation failed: ${errorMessage}`);
      throw error;
    }
  }
}
