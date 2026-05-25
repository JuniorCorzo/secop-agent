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

/**
 * BullMQ background worker that processes scoring dispatch jobs.
 * Evaluates procurement notices against all registered companies, checking hard filters and calculating affinity scores.
 */
@Processor(QUEUE_NAMES.SCORING)
@Injectable()
export class ScoringWorker extends WorkerHost {
  /**
   * Logger instance for the scoring worker.
   */
  private readonly logger = new Logger(ScoringWorker.name);

  /**
   * Initializes the ScoringWorker.
   *
   * @param noticeRepository - Repository to interact with procurement notices.
   * @param companyRepository - Repository to interact with companies.
   * @param companyContractRepository - Repository to interact with company contracts.
   * @param matchingResultRepository - Repository to interact with matching results.
   * @param hardFiltersService - Service to evaluate hard exclusion filters.
   * @param scoringEngineService - Service to calculate matching affinity scores.
   */
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

  /**
   * Main entry point to process a scoring job.
   * Fetches notice, removes existing matches, checks filters, scores each company, and persists results.
   *
   * @param job - The BullMQ job containing notice details.
   * @returns A promise resolving to the processing summary.
   */
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
   *
   * @param procurementNoticeId - The ID of the procurement notice to retrieve.
   * @returns The transitioned ProcurementNotice entity.
   * @throws Error if the notice is not found.
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
   *
   * @param noticeId - The ID of the procurement notice.
   * @returns A promise that resolves when deletion is complete.
   */
  private async deleteExistingResults(noticeId: string): Promise<void> {
    await this.matchingResultRepository.delete({ notice: { id: noticeId } });
  }

  /**
   * Fetches all companies and contracts from the database.
   *
   * @returns A promise resolving to an object containing lists of companies and contracts.
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
   *
   * @param allContracts - The list of all contracts to group.
   * @returns A record mapping company ID strings to arrays of their contracts.
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
   *
   * @param notice - The procurement notice to match against.
   * @param companies - The list of all companies.
   * @param contractsByCompanyId - Grouped contracts by company ID.
   * @returns A promise that resolves when all matches have been processed and saved.
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
  /**
   * Event handler called when a scoring job completes successfully.
   *
   * @param job - The completed BullMQ job.
   */
  onCompleted(job: Job): void {
    this.logger.log(`Scoring job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  /**
   * Event handler called when a scoring job fails.
   *
   * @param job - The failed BullMQ job.
   * @param error - The error that caused the failure.
   */
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Scoring job ${job.id} failed: ${error.message}`);
  }
}
