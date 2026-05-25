import { ScoringController } from '../src/modules/scoring/controllers/scoring.controller';
import { ScoringQueryService } from '../src/modules/scoring/services/scoring-query.service';
import { CompanyScoringBatchProducer } from '../src/modules/queues/producers/company-scoring-batch.producer';
import { MatchingResult } from '../src/modules/scoring/entities/matching-result.entity';
import { ScoreLog } from '../src/modules/scoring/entities/score-log.entity';
import { Company } from '../src/modules/companies/entities/company.entity';
import { ProcurementNotice } from '../src/modules/procurement-notices/entities/procurement-notice.entity';
import { NotFoundException } from '@nestjs/common';

describe('ScoringController', () => {
  let controller: ScoringController;
  let scoringQueryService: jest.Mocked<ScoringQueryService>;
  let batchProducer: jest.Mocked<CompanyScoringBatchProducer>;

  const companyId = 'a1b2c3d4-0000-0000-0000-000000000001';
  const noticeId = 'a1b2c3d4-0000-0000-0000-000000000002';

  beforeEach(() => {
    scoringQueryService = {
      getLatestResult: jest.fn(),
      getLatestScoreLog: jest.fn(),
    } as any;

    batchProducer = {
      add: jest.fn(),
    } as any;

    controller = new ScoringController(scoringQueryService, batchProducer);
  });

  describe('GET /:companyId/:noticeId', () => {
    it('returns merged result and score-log data for a valid pair', async () => {
      const company = new Company();
      company.id = companyId;

      const notice = new ProcurementNotice();
      notice.id = noticeId;

      const result = Object.assign(new MatchingResult(), {
        id: 'result-id',
        company,
        notice,
        status: 'PASSED',
        score: 75,
        vectorBreakdown: { technicalFit: { score: 30 } },
        justification: 'Rule-based justification',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      });

      const log = Object.assign(new ScoreLog(), {
        id: 'log-id',
        category: 'VIABLE',
        explanation: 'LLM narrative',
      });

      scoringQueryService.getLatestResult.mockResolvedValue(result);
      scoringQueryService.getLatestScoreLog.mockResolvedValue(log);

      const response = await controller.getResult(companyId, noticeId);

      expect(response).toMatchObject({
        id: 'result-id',
        companyId,
        noticeId,
        status: 'PASSED',
        score: 75,
        category: 'VIABLE',
        explanation: 'LLM narrative',
      });
    });

    it('propagates NotFoundException when no result exists', async () => {
      scoringQueryService.getLatestResult.mockRejectedValue(
        new NotFoundException(`No scoring result found for company ${companyId} and notice ${noticeId}`),
      );

      await expect(controller.getResult(companyId, noticeId)).rejects.toThrow(NotFoundException);
    });

    it('returns null category and explanation when no score log exists', async () => {
      const company = new Company();
      company.id = companyId;
      const notice = new ProcurementNotice();
      notice.id = noticeId;

      const result = Object.assign(new MatchingResult(), {
        id: 'result-id',
        company,
        notice,
        status: 'EXCLUDED',
        score: 0,
        vectorBreakdown: {},
        justification: 'Excluded by hard filter',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      scoringQueryService.getLatestResult.mockResolvedValue(result);
      scoringQueryService.getLatestScoreLog.mockResolvedValue(null);

      const response = await controller.getResult(companyId, noticeId);

      expect(response.category).toBeNull();
      expect(response.explanation).toBeNull();
    });
  });

  describe('POST /:companyId/batch', () => {
    it('enqueues a batch scoring job and returns the job ID', async () => {
      batchProducer.add.mockResolvedValue({ id: 'job-123' } as any);

      const dto = { noticeIds: [noticeId] };
      const response = await controller.enqueueBatch(companyId, dto as any);

      expect(batchProducer.add).toHaveBeenCalledWith({
        companyId,
        noticeIds: [noticeId],
      });
      expect(response).toEqual({ jobId: 'job-123' });
    });
  });
});
