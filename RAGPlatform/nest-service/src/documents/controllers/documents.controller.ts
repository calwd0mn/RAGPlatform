import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthUser } from '../../auth/interfaces/auth-user.interface';
import { DOCUMENT_MULTER_OPTIONS } from '../utils/document-file.util';
import { DocumentIdParamDto } from '../dto/document-id-param.dto';
import { ListDocumentsQueryDto } from '../dto/list-documents-query.dto';
import { UploadDocumentDto } from '../dto/upload-document.dto';
import { DocumentResponse } from '../interfaces/document-response.interface';
import { UploadedDocumentFile } from '../interfaces/uploaded-document-file.interface';
import { DocumentsService } from '../services/documents.service';

@UseGuards(JwtAuthGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', DOCUMENT_MULTER_OPTIONS))
  upload(
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadDocumentDto,
    @UploadedFile() file: UploadedDocumentFile | undefined,
  ): Promise<DocumentResponse> {
    return this.documentsService.createFromUpload(user.id, dto.knowledgeBaseId, file);
  }

  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query() query: ListDocumentsQueryDto,
  ): Promise<DocumentResponse[]> {
    return this.documentsService.findAllByUser(user.id, query.knowledgeBaseId);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param() params: DocumentIdParamDto,
  ): Promise<DocumentResponse> {
    return this.documentsService.findOneByUser(user.id, params.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@CurrentUser() user: AuthUser, @Param() params: DocumentIdParamDto): Promise<void> {
    return this.documentsService.remove(user.id, params.id);
  }
}
