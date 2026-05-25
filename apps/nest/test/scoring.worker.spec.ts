import { Job } from 'bullmq';
import { ScoringWorker } from '../src/modules/scoring/workers/scoring.worker';
import { ProcurementNotice } from '../src/modules/procurement-notices/entities/procurement-notice.entity';
import { Company } from '../src/modules/companies/entities/company.entity';
import { CompanyContract } from '../src/modules/companies/entities/company-contract.entity';
import { MatchingResult } from '../src/modules/scoring/entities/matching-result.entity';
import { HardFiltersService } from '../src/modules/scoring/services/hard-filters.service';
import { ScoringEngineService } from '../src/modules/scoring/services/scoring-engine.service';

describe('ScoringWorker', () => {
  let worker: ScoringWorker;
  let noticeRepo: any;
  let companyRepo: any;
  let contractRepo: any;
  let matchingResultRepo: any;
  let hardFiltersService: HardFiltersService;
  let scoringEngineService: ScoringEngineService;

  beforeEach(() => {
    noticeRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };
    companyRepo = {
      find: jest.fn(),
    };
    contractRepo = {
      find: jest.fn(),
    };
    matchingResultRepo = {
      delete: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    hardFiltersService = new HardFiltersService();
    scoringEngineService = new ScoringEngineService();

    worker = new ScoringWorker(
      noticeRepo,
      companyRepo,
      contractRepo,
      matchingResultRepo,
      hardFiltersService,
      scoringEngineService,
    );
  });

  it('skips processing if the notice does not exist', async () => {
    noticeRepo.findOne.mockResolvedValue(null);
    const job = {
      id: 'job-1',
      data: { procurementNoticeId: 'notice-uuid', secopId: 'secop-id', sourceEvent: 'NewProcurementNoticeEvent' },
    } as Job;

    await expect(worker.process(job)).rejects.toThrow('Procurement notice notice-uuid not found');
  });

  it('runs matching, persists PASSED and EXCLUDED results, and sets notice status to SCORING', async () => {
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
    companyPassed.regions = ['25']; // Cundinamarca
    companyPassed.contractingCapacity = 500000;

    const companyExcluded = new Company();
    companyExcluded.id = 'company-excluded';
    companyExcluded.nit = '900000002';
    companyExcluded.name = 'Excluded Company';
    companyExcluded.sectors = ['801015']; // Different UNSPSC sector
    companyExcluded.regions = ['25'];
    companyExcluded.contractingCapacity = 500000;

    noticeRepo.findOne.mockResolvedValue(notice);
    noticeRepo.save.mockResolvedValue(notice);
    companyRepo.find.mockResolvedValue([companyPassed, companyExcluded]);
    contractRepo.find.mockResolvedValue([]);

    matchingResultRepo.create.mockImplementation((dto: any) => dto);
    matchingResultRepo.save.mockImplementation((dto: any) => Promise.resolve({ id: 'res-id', ...dto }));

    const job = {
      id: 'job-1',
      data: { procurementNoticeId: 'notice-uuid', secopId: 'secop-id', sourceEvent: 'NewProcurementNoticeEvent' },
    } as Job;

    const result = await worker.process(job);

    expect(result).toEqual({ processed: true, companiesMatched: 2 });
    expect(notice.status).toBe('SCORING');
    expect(noticeRepo.save).toHaveBeenCalledWith(notice);
    expect(matchingResultRepo.delete).toHaveBeenCalledWith({ notice: { id: 'notice-uuid' } });

    // Expecting 2 matching results created and saved
    expect(matchingResultRepo.create).toHaveBeenCalledTimes(2);
    expect(matchingResultRepo.save).toHaveBeenCalledTimes(2);

    // Verify first result is PASSED
    const passedCall = matchingResultRepo.create.mock.calls.find((call: any) => call[0].company.id === 'company-passed')[0];
    expect(passedCall.status).toBe('PASSED');
    expect(passedCall.score).toBeGreaterThan(0);
    expect(passedCall.justification).toContain('Puntaje total');

    // Verify second result is EXCLUDED
    const excludedCall = matchingResultRepo.create.mock.calls.find((call: any) => call[0].company.id === 'company-excluded')[0];
    expect(excludedCall.status).toBe('EXCLUDED');
    expect(excludedCall.score).toBe(0);
    expect(excludedCall.justification).toContain('código UNSPSC');
  });
});
