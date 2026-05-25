import { Job } from 'bullmq';
import { ScoringWorker } from '../src/modules/scoring/workers/scoring.worker';
import { ProcurementNotice } from '../src/modules/procurement-notices/entities/procurement-notice.entity';
import { Company } from '../src/modules/companies/entities/company.entity';
import { CompanyContract } from '../src/modules/companies/entities/company-contract.entity';
import { MatchingResult } from '../src/modules/scoring/entities/matching-result.entity';
import { ScoreLog } from '../src/modules/scoring/entities/score-log.entity';
import { HardFiltersService } from '../src/modules/scoring/services/hard-filters.service';
import { ScoringEngineService } from '../src/modules/scoring/services/scoring-engine.service';
import { LlmProvider } from '../src/modules/llm/interfaces/llm-provider.interface';

describe('ScoringWorker', () => {
  let worker: ScoringWorker;
  let noticeRepo: any;
  let companyRepo: any;
  let contractRepo: any;
  let matchingResultRepo: any;
  let scoreLogRepo: any;
  let hardFiltersService: HardFiltersService;
  let scoringEngineService: ScoringEngineService;
  let llmProvider: any;

  beforeEach(() => {
    noticeRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
    };
    companyRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };
    contractRepo = {
      find: jest.fn(),
    };
    matchingResultRepo = {
      findOne: jest.fn(),
      delete: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };
    scoreLogRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    llmProvider = {
      chat: jest.fn(),
      embed: jest.fn(),
      health: jest.fn(),
    };

    hardFiltersService = new HardFiltersService();
    scoringEngineService = new ScoringEngineService();

    worker = new ScoringWorker(
      noticeRepo,
      companyRepo,
      contractRepo,
      matchingResultRepo,
      scoreLogRepo,
      hardFiltersService,
      scoringEngineService,
      llmProvider,
    );
  });

  describe('scoring-dispatch job', () => {
    it('skips processing if the notice does not exist', async () => {
      noticeRepo.findOne.mockResolvedValue(null);
      const job = {
        name: 'scoring-dispatch',
        id: 'job-1',
        data: { procurementNoticeId: 'notice-uuid', secopId: 'secop-id', sourceEvent: 'NewProcurementNoticeEvent' },
      } as Job;

      await expect(worker.process(job)).rejects.toThrow('Procurement notice notice-uuid not found');
    });

    it('runs matching, persists MatchingResult (upserted) and ScoreLog (appended), categorizes, and requests LLM narrative', async () => {
      const notice = new ProcurementNotice();
      notice.id = 'notice-uuid';
      notice.status = 'ENRICHING';
      notice.unspscCode = '43211502';
      notice.value = 100000;
      notice.department = 'Cundinamarca';

      const companyPassed = new Company();
      companyPassed.id = 'company-passed';
      companyPassed.nit = '900000001';
      companyPassed.name = 'Passed Company';
      companyPassed.sectors = ['432115'];
      companyPassed.regions = ['25'];
      companyPassed.contractingCapacity = 500000;

      noticeRepo.findOne.mockResolvedValue(notice);
      noticeRepo.save.mockResolvedValue(notice);
      companyRepo.find.mockResolvedValue([companyPassed]);
      contractRepo.find.mockResolvedValue([]);

      matchingResultRepo.findOne.mockResolvedValue(null);
      matchingResultRepo.create.mockImplementation((dto: any) => dto);
      matchingResultRepo.save.mockImplementation((dto: any) => Promise.resolve({ id: 'res-id', ...dto }));
      scoreLogRepo.create.mockImplementation((dto: any) => dto);
      scoreLogRepo.save.mockImplementation((dto: any) => Promise.resolve({ id: 'log-id', ...dto }));

      llmProvider.chat.mockResolvedValue({ content: 'LLM generated narrative explanation' });

      const job = {
        name: 'scoring-dispatch',
        id: 'job-1',
        data: { procurementNoticeId: 'notice-uuid', secopId: 'secop-id', sourceEvent: 'NewProcurementNoticeEvent' },
      } as Job;

      const result = await worker.process(job);

      expect(result).toEqual({ processed: true, companiesMatched: 1 });
      expect(notice.status).toBe('SCORING');
      expect(noticeRepo.save).toHaveBeenCalledWith(notice);

      // Verify MatchingResult logic
      expect(matchingResultRepo.save).toHaveBeenCalled();
      const matchingSaveCall = matchingResultRepo.save.mock.calls[0][0];
      expect(matchingSaveCall.status).toBe('PASSED');
      expect(matchingSaveCall.score).toBeGreaterThan(0);

      // Verify ScoreLog logic
      expect(scoreLogRepo.save).toHaveBeenCalled();
      const logSaveCall = scoreLogRepo.save.mock.calls[0][0];
      expect(logSaveCall.totalScore).toBe(matchingSaveCall.score);
      expect(logSaveCall.category).toBeDefined();
      expect(logSaveCall.explanation).toBe('LLM generated narrative explanation');
      expect(llmProvider.chat).toHaveBeenCalled();
    });

    it('falls back to rule-based justification if LLM provider throws an error', async () => {
      const notice = new ProcurementNotice();
      notice.id = 'notice-uuid';
      notice.status = 'ENRICHING';
      notice.unspscCode = '43211502';
      notice.value = 100000;
      notice.department = 'Cundinamarca';

      const companyPassed = new Company();
      companyPassed.id = 'company-passed';
      companyPassed.nit = '900000001';
      companyPassed.name = 'Passed Company';
      companyPassed.sectors = ['432115'];
      companyPassed.regions = ['25'];
      companyPassed.contractingCapacity = 500000;

      noticeRepo.findOne.mockResolvedValue(notice);
      noticeRepo.save.mockResolvedValue(notice);
      companyRepo.find.mockResolvedValue([companyPassed]);
      contractRepo.find.mockResolvedValue([]);

      matchingResultRepo.findOne.mockResolvedValue(null);
      matchingResultRepo.create.mockImplementation((dto: any) => dto);
      matchingResultRepo.save.mockImplementation((dto: any) => Promise.resolve({ id: 'res-id', ...dto }));
      scoreLogRepo.create.mockImplementation((dto: any) => dto);
      scoreLogRepo.save.mockImplementation((dto: any) => Promise.resolve({ id: 'log-id', ...dto }));

      llmProvider.chat.mockRejectedValue(new Error('LLM Service Unavailable'));

      const job = {
        name: 'scoring-dispatch',
        id: 'job-1',
        data: { procurementNoticeId: 'notice-uuid', secopId: 'secop-id', sourceEvent: 'NewProcurementNoticeEvent' },
      } as Job;

      await expect(worker.process(job)).resolves.toEqual({ processed: true, companiesMatched: 1 });

      const logSaveCall = scoreLogRepo.save.mock.calls[0][0];
      expect(logSaveCall.explanation).toContain('Puntaje total de afinidad'); // default rule-based justification fallback
    });
  });

  describe('company-batch-scoring job', () => {
    it('skips processing if the company does not exist', async () => {
      companyRepo.findOne.mockResolvedValue(null);
      const job = {
        name: 'company-batch-scoring',
        id: 'job-2',
        data: { companyId: 'company-uuid', noticeIds: ['notice-uuid-1'] },
      } as Job;

      await expect(worker.process(job)).rejects.toThrow('Company company-uuid not found');
    });

    it('evaluates single company against multiple notices and persists results', async () => {
      const company = new Company();
      company.id = 'company-uuid';
      company.nit = '900000001';
      company.name = 'Test Company';
      company.sectors = ['432115'];
      company.regions = ['25'];
      company.contractingCapacity = 500000;

      const notice1 = new ProcurementNotice();
      notice1.id = 'notice-uuid-1';
      notice1.status = 'ENRICHING';
      notice1.unspscCode = '43211502';
      notice1.value = 100000;
      notice1.department = 'Cundinamarca';

      const notice2 = new ProcurementNotice();
      notice2.id = 'notice-uuid-2';
      notice2.status = 'ENRICHING';
      notice2.unspscCode = '80101502'; // will be excluded
      notice2.value = 100000;
      notice2.department = 'Cundinamarca';

      companyRepo.findOne.mockResolvedValue(company);
      noticeRepo.find.mockResolvedValue([notice1, notice2]);
      contractRepo.find.mockResolvedValue([]);

      matchingResultRepo.findOne.mockResolvedValue(null);
      matchingResultRepo.create.mockImplementation((dto: any) => dto);
      matchingResultRepo.save.mockImplementation((dto: any) => Promise.resolve({ id: 'res-id', ...dto }));
      scoreLogRepo.create.mockImplementation((dto: any) => dto);
      scoreLogRepo.save.mockImplementation((dto: any) => Promise.resolve({ id: 'log-id', ...dto }));

      llmProvider.chat.mockResolvedValue({ content: 'LLM justification' });

      const job = {
        name: 'company-batch-scoring',
        id: 'job-2',
        data: { companyId: 'company-uuid', noticeIds: ['notice-uuid-1', 'notice-uuid-2'] },
      } as Job;

      const result = await worker.process(job);

      expect(result).toEqual({ processed: true, noticesMatched: 2 });

      // Should have saved 2 MatchingResults and 2 ScoreLogs
      expect(matchingResultRepo.save).toHaveBeenCalledTimes(2);
      expect(scoreLogRepo.save).toHaveBeenCalledTimes(2);

      // First notice was viable/passed
      const match1 = matchingResultRepo.save.mock.calls[0][0];
      expect(match1.notice.id).toBe('notice-uuid-1');
      expect(match1.status).toBe('PASSED');

      // Second notice was excluded
      const match2 = matchingResultRepo.save.mock.calls[1][0];
      expect(match2.notice.id).toBe('notice-uuid-2');
      expect(match2.status).toBe('EXCLUDED');

      // Score logs should have proper category
      const log1 = scoreLogRepo.save.mock.calls[0][0];
      expect(log1.category).not.toBe('EXCLUIDO');
      expect(log1.explanation).toBe('LLM justification');

      const log2 = scoreLogRepo.save.mock.calls[1][0];
      expect(log2.category).toBe('EXCLUIDO');
      expect(log2.explanation).toContain('código UNSPSC'); // rule-based fallback
    });
  });
});
