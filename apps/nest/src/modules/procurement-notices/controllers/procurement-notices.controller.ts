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
import { LifecycleTransitionDto } from '../dto/lifecycle-transition.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/entities/user.entity';

/**
 * REST controller for procurement notice management.
 *
 * All endpoints require JWT authentication. Role-based access is enforced per-route:
 * - `admin` + `analista`: CRUD, search, bulk ingest, lifecycle transitions.
 * - `admin` only: deletion.
 *
 * @see procnotices-spec - CRUD Access, Search and Pagination, Bulk Ingest, Lifecycle Progression
 */
@Controller('procurement-notices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProcurementNoticesController {
  constructor(
    private readonly service: ProcurementNoticesService,
    private readonly ingestionService: ProcurementIngestionService,
  ) {}

  /**
   * Creates a single procurement notice.
   *
   * - Validates the request body via {@link CreateProcurementNoticeDto}.
   * - Returns the persisted entity with its generated UUID.
   *
   * @returns `201 Created` with the entity.
   * @throws `400 Bad Request` if the DTO is invalid.
   * @throws `409 Conflict` if `secopId` already exists.
   */
  @Post()
  @Roles(UserRole.admin, UserRole.analista)
  create(@Body() dto: CreateProcurementNoticeDto) {
    return this.service.create(dto);
  }

  /**
   * Enqueues a batch of procurement notices for asynchronous ingestion via BullMQ.
   *
   * Accepts both `/bulk-ingest` and `/bulk` routes for backward compatibility.
   * Returns a job ID immediately — processing happens in the background.
   *
   * @returns `{ jobId: string }` — the BullMQ job identifier.
   * @throws `400 Bad Request` if the payload exceeds 1000 records or DTO validation fails.
   */
  @Post('bulk-ingest')
  @Post('bulk')
  @Roles(UserRole.admin, UserRole.analista)
  async bulkIngest(@Body() dto: BulkIngestionDto) {
    return this.ingestionService.enqueueBulkIngestion(dto);
  }

  /**
   * Searches and lists procurement notices with filters, text search, ordering, and pagination.
   *
   * Query parameters are validated by {@link SearchProcurementNoticeDto}.
   *
   * @returns `200 OK` with paginated results and metadata.
   */
  @Get()
  search(@Query() dto: SearchProcurementNoticeDto) {
    return this.service.findAll(dto);
  }

  /**
   * Retrieves a single procurement notice by internal UUID.
   *
   * @returns `200 OK` with the entity.
   * @throws `404 Not Found` if the UUID doesn't exist or is soft-deleted.
   */
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  /**
   * Partially updates a procurement notice.
   *
   * Only provided fields are merged. If `status` is included, the transition
   * is validated against the lifecycle state machine.
   *
   * @returns `200 OK` with the updated entity.
   * @throws `400 Bad Request` if the status transition is invalid.
   * @throws `404 Not Found` if the UUID doesn't exist.
   */
  @Patch(':id')
  @Roles(UserRole.admin, UserRole.analista)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProcurementNoticeDto,
  ) {
    return this.service.update(id, dto);
  }

  /**
   * Advances a procurement notice to the next lifecycle state.
   *
   * Validates the transition via {@link canTransitionProcurementNoticeStatus}.
   *
   * @returns `200 OK` with the updated entity.
   * @throws `400 Bad Request` if the transition is not allowed.
   * @throws `404 Not Found` if the UUID doesn't exist.
   */
  @Patch(':id/lifecycle')
  @Roles(UserRole.admin, UserRole.analista)
  transitionLifecycle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LifecycleTransitionDto,
  ) {
    return this.service.transitionLifecycle(id, dto.targetStatus);
  }

  /**
   * Soft-deletes a procurement notice. Sets `deletedAt` without removing the row.
   *
   * Restricted to `admin` role only.
   *
   * @returns `204 No Content` on success.
   * @throws `404 Not Found` if the UUID doesn't exist or is already deleted.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles(UserRole.admin)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  /**
   * Re-classifies a procurement notice using the Keyword Scoring algorithm.
   *
   * Loads the sector keyword catalog, scores the notice `title`, persists the
   * winning sector, and returns the updated notice with the full score breakdown.
   *
   * @returns `200 OK` with `{ notice, scores }`.
   * @throws `404 Not Found` if the UUID doesn't exist.
   */
  @Post(':id/classify')
  @Roles(UserRole.admin, UserRole.analista)
  classifyNotice(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.classifyNotice(id);
  }
}

