import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CompanyScoringBatchProducer } from '../../queues/producers/company-scoring-batch.producer';
import { ScoringQueryService } from '../services/scoring-query.service';
import { BatchScoringDto } from '../dto/batch-scoring.dto';

/**
 * REST controller for the scoring module.
 *
 * Exposes endpoints for retrieving matching results and scheduling
 * asynchronous batch scoring jobs. All routes are JWT-protected.
 *
 * @route /api/scoring
 */
@Controller('scoring')
@UseGuards(JwtAuthGuard)
export class ScoringController {
  constructor(
    private readonly scoringQueryService: ScoringQueryService,
    private readonly companyScoringBatchProducer: CompanyScoringBatchProducer,
  ) {}

  /**
   * Returns the latest scoring result (status, category, score, and explanation)
   * for a specific company–notice pair.
   *
   * @param companyId - UUID of the company to look up.
   * @param noticeId - UUID of the procurement notice.
   * @returns The matching result with the latest score log category and explanation.
   * @throws `404 Not Found` if no result exists.
   */
  @Get(':companyId/:noticeId')
  async getResult(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('noticeId', ParseUUIDPipe) noticeId: string,
  ) {
    const result = await this.scoringQueryService.getLatestResult(companyId, noticeId);
    const latestLog = await this.scoringQueryService.getLatestScoreLog(companyId, noticeId);

    return {
      id: result.id,
      companyId: result.company.id,
      noticeId: result.notice.id,
      status: result.status,
      score: result.score,
      vectorBreakdown: result.vectorBreakdown,
      justification: result.justification,
      category: latestLog?.category ?? null,
      explanation: latestLog?.explanation ?? null,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  }

  /**
   * Enqueues a batch scoring job for a company against a list of procurement notices.
   *
   * The job is processed asynchronously by {@link ScoringWorker} using the
   * `company-batch-scoring` BullMQ job type.
   *
   * @param companyId - UUID of the company to score.
   * @param dto - Request body containing the list of procurement notice UUIDs (max 100).
   * @returns A `202 Accepted` response with the generated BullMQ job ID.
   * @throws `400 Bad Request` if the UUID or DTO validation fails.
   */
  @Post(':companyId/batch')
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueueBatch(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: BatchScoringDto,
  ) {
    const job = await this.companyScoringBatchProducer.add({
      companyId,
      noticeIds: dto.noticeIds,
    });

    return { jobId: job.id };
  }
}
