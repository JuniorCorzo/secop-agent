import { NotFoundException } from '@nestjs/common';
import { ScoringQueryService } from '../src/modules/scoring/services/scoring-query.service';
import { MatchingResult } from '../src/modules/scoring/entities/matching-result.entity';
import { ScoreLog } from '../src/modules/scoring/entities/score-log.entity';
import { Company } from '../src/modules/companies/entities/company.entity';
import { ProcurementNotice } from '../src/modules/procurement-notices/entities/procurement-notice.entity';

describe('ScoringQueryService', () => {
  let service: ScoringQueryService;
  let matchingResultRepo: any;
  let scoreLogRepo: any;

  const companyId = 'a1b2c3d4-0000-0000-0000-000000000001';
  const noticeId = 'a1b2c3d4-0000-0000-0000-000000000002';

  beforeEach(() => {
    matchingResultRepo = { findOne: jest.fn() };
    scoreLogRepo = { find: jest.fn() };
    service = new ScoringQueryService(matchingResultRepo, scoreLogRepo);
  });

  describe('getLatestResult', () => {
    it('returns the matching result for a valid company–notice pair', async () => {
      const company = new Company();
      company.id = companyId;
      const notice = new ProcurementNotice();
      notice.id = noticeId;

      const result = Object.assign(new MatchingResult(), {
        id: 'result-id',
        company,
        notice,
        status: 'PASSED',
        score: 82,
      });

      matchingResultRepo.findOne.mockResolvedValue(result);

      const returned = await service.getLatestResult(companyId, noticeId);
      expect(returned).toBe(result);
      expect(matchingResultRepo.findOne).toHaveBeenCalledWith({
        where: { company: { id: companyId }, notice: { id: noticeId } },
        relations: { company: true, notice: true },
      });
    });

    it('throws NotFoundException when no result exists', async () => {
      matchingResultRepo.findOne.mockResolvedValue(null);

      await expect(service.getLatestResult(companyId, noticeId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLatestScoreLog', () => {
    it('returns the most recent ScoreLog for a valid pair', async () => {
      const log = Object.assign(new ScoreLog(), {
        id: 'log-id',
        category: 'VIABLE',
        explanation: 'Meets all criteria',
        createdAt: new Date('2026-01-15'),
      });

      scoreLogRepo.find.mockResolvedValue([log]);

      const returned = await service.getLatestScoreLog(companyId, noticeId);
      expect(returned).toBe(log);
      expect(scoreLogRepo.find).toHaveBeenCalledWith({
        where: { company: { id: companyId }, notice: { id: noticeId } },
        relations: { company: true, notice: true },
        order: { createdAt: 'DESC' },
        take: 1,
      });
    });

    it('returns null when no score log exists', async () => {
      scoreLogRepo.find.mockResolvedValue([]);

      const returned = await service.getLatestScoreLog(companyId, noticeId);
      expect(returned).toBeNull();
    });
  });
});
