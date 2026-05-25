import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queues/constants/queue-names';
import { ScoringDispatchJobData } from '../../queues/producers/scoring-dispatch.producer';
import { ProcurementNotice } from '../../procurement-notices/entities/procurement-notice.entity';
import { Company } from '../../companies/entities/company.entity';
import { CompanyContract } from '../../companies/entities/company-contract.entity';
import { MatchingResult } from '../entities/matching-result.entity';
import { HardFiltersService } from '../services/hard-filters.service';
import { ScoringEngineService } from '../services/scoring-engine.service';

@Processor(QUEUE_NAMES.SCORING)
@Injectable()
export class ScoringWorker extends WorkerHost {
  private readonly logger = new Logger(ScoringWorker.name);

  constructor(
    @InjectRepository(ProcurementNotice)
    private readonly noticeRepository: Repository<ProcurementNotice>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyContract)
    private readonly companyContractRepository: Repository<CompanyContract>,
    @InjectRepository(MatchingResult)
    private readonly matchingResultRepository: Repository<MatchingResult>,
    private readonly hardFiltersService: HardFiltersService,
    private readonly scoringEngineService: ScoringEngineService,
  ) {
    super();
  }

  async process(job: Job<ScoringDispatchJobData>): Promise<{ processed: true; companiesMatched: number }> {
    const { procurementNoticeId, secopId } = job.data;
    this.logger.log(`Processing scoring match for notice ${procurementNoticeId} (${secopId})`);

    const notice = await this.fetchAndTransitionNotice(procurementNoticeId);

    await this.deleteExistingResults(notice.id);

    const { companies, allContracts } = await this.fetchCompaniesAndContracts();

    const contractsByCompanyId = this.groupContractsByCompany(allContracts);

    await this.processCompanyMatching(notice, companies, contractsByCompanyId);

    this.logger.log(`Completed matching for notice ${procurementNoticeId} against ${companies.length} companies`);
    return { processed: true, companiesMatched: companies.length };
  }

  /**
   * Fetches the procurement notice and transitions its status to SCORING.
   */
  private async fetchAndTransitionNotice(procurementNoticeId: string): Promise<ProcurementNotice> {
    const notice = await this.noticeRepository.findOne({ where: { id: procurementNoticeId } });
    if (!notice) {
      throw new Error(`Procurement notice ${procurementNoticeId} not found`);
    }

    notice.status = 'SCORING';
    await this.noticeRepository.save(notice);
    return notice;
  }

  /**
   * Deletes existing matching results for a notice to prevent duplicates.
   */
  private async deleteExistingResults(noticeId: string): Promise<void> {
    await this.matchingResultRepository.delete({ notice: { id: noticeId } });
  }

  /**
   * Fetches all companies and contracts from the database.
   */
  private async fetchCompaniesAndContracts(): Promise<{
    companies: Company[];
    allContracts: CompanyContract[];
  }> {
    const companies = await this.companyRepository.find();
    const allContracts = await this.companyContractRepository.find({
      relations: { company: true },
    });
    return { companies, allContracts };
  }

  /**
   * Groups company contracts by their associated company ID.
   */
  private groupContractsByCompany(allContracts: CompanyContract[]): Record<string, CompanyContract[]> {
    const contractsByCompanyId: Record<string, CompanyContract[]> = {};
    for (const contract of allContracts) {
      if (contract.company?.id) {
        const cId = contract.company.id;
        if (!contractsByCompanyId[cId]) {
          contractsByCompanyId[cId] = [];
        }
        contractsByCompanyId[cId].push(contract);
      }
    }
    return contractsByCompanyId;
  }

  /**
   * Processes the hard filter evaluation and scoring match for all companies.
   */
  private async processCompanyMatching(
    notice: ProcurementNotice,
    companies: Company[],
    contractsByCompanyId: Record<string, CompanyContract[]>,
  ): Promise<void> {
    for (const company of companies) {
      const companyContracts = contractsByCompanyId[company.id] || [];

      // Evaluate hard filters
      const filterResult = this.hardFiltersService.evaluate(company, notice, companyContracts);

      let matchingResult: MatchingResult;

      if (!filterResult.passed) {
        matchingResult = this.matchingResultRepository.create({
          status: 'EXCLUDED',
          score: 0,
          vectorBreakdown: {},
          justification: filterResult.justification,
          company,
          notice,
        });
      } else {
        // Compute scoring
        const scoreResult = this.scoringEngineService.computeScore(company, notice, companyContracts);
        matchingResult = this.matchingResultRepository.create({
          status: 'PASSED',
          score: scoreResult.score,
          vectorBreakdown: scoreResult.vectorBreakdown,
          justification: scoreResult.justification,
          company,
          notice,
        });
      }

      await this.matchingResultRepository.save(matchingResult);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`Scoring job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Scoring job ${job.id} failed: ${error.message}`);
  }
}
