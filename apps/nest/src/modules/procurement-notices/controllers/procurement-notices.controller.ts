import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProcurementNoticesService } from '../services/procurement-notices.service';
import { ProcurementIngestionService } from '../services/ingestion.service';
import { CreateProcurementNoticeDto } from '../dto/create-procurement-notice.dto';
import { UpdateProcurementNoticeDto } from '../dto/update-procurement-notice.dto';
import { SearchProcurementNoticeDto } from '../dto/search-procurement-notice.dto';
import { BulkIngestionDto } from '../dto/bulk-ingestion.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';

@Controller('procurement-notices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProcurementNoticesController {
  constructor(
    private readonly service: ProcurementNoticesService,
    private readonly ingestionService: ProcurementIngestionService,
  ) {}

  @Post()
  @Roles(UserRole.admin, UserRole.analista)
  create(@Body() dto: CreateProcurementNoticeDto) {
    return this.service.create(dto);
  }

  @Post('bulk')
  @Roles(UserRole.admin, UserRole.analista)
  async bulkIngest(@Body() dto: BulkIngestionDto) {
    return this.ingestionService.enqueueBulkIngestion(dto);
  }

  @Get()
  search(@Query() dto: SearchProcurementNoticeDto) {
    return this.service.search(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.admin, UserRole.analista)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProcurementNoticeDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.admin)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
