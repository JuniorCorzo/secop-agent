import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { In } from 'typeorm';
import type { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queues/constants/queue-names';
import type { ScoringDispatchJobData } from '../../queues/producers/scoring-dispatch.producer';
import type { CompanyScoringBatchJobData } from '../../queues/producers/company-scoring-batch.producer';
import { ProcurementNotice } from '../../procurement-notices/entities/procurement-notice.entity';
import { Company } from '../../companies/entities/company.entity';
import { CompanyContract } from '../../companies/entities/company-contract.entity';
import type { ScoringPersistenceService } from '../services/scoring-persistence.service';

/** Signature for a job-type handler. */
type JobHandler = (job: Job<any>) => Promise<any>;

/**
 * BullMQ background worker that processes scoring dispatch and batch scoring jobs.
 *
 * Uses a strategy map for OCP-compliant job dispatch so that new job types
 * can be added by registering a new handler without modifying the process method.
 */
@Processor(QUEUE_NAMES.SCORING)
@Injectable()
export class ScoringWorker extends WorkerHost {
  private readonly logger = new Logger(ScoringWorker.name);

  /** Strategy map: job name → handler function. */
  private readonly jobHandlers: Map<string, JobHandler>;

  constructor(
    @InjectRepository(ProcurementNotice)
    private readonly noticeRepository: Repository<ProcurementNotice>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CompanyContract)
    private readonly companyContractRepository: Repository<CompanyContract>,
    private readonly scoringPersistence: ScoringPersistenceService,
  ) {
    super();

    this.jobHandlers = new Map<string, JobHandler>([
      ['company-batch-scoring', this.processCompanyBatchScoring.bind(this)],
      ['scoring-dispatch', this.processScoringDispatch.bind(this)],
    ]);
  }

  /**
   * Main entry point. Dispatches to the appropriate handler via the strategy map.
   */
  async process(job: Job<any>): Promise<any> {
    const handler = this.jobHandlers.get(job.name);
    if (!handler) {
      throw new Error(`Unknown job name: ${job.name}`);
    }
    return handler(job);
  }

  // ── Job-type handlers ─────────────────────────────────────────

  /**
   * Processes the company-batch-scoring job type.
   */
  private async processCompanyBatchScoring(
    job: Job<CompanyScoringBatchJobData>,
  ): Promise<{ processed: true; noticesMatched: number }> {
    const { companyId, noticeIds } = job.data;
    this.logger.log(`Processing batch scoring for company ${companyId} against ${noticeIds.length} notices`);

    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new Error(`Company ${companyId} not found`);
    }

    const companyContracts = await this.companyContractRepository.find({
      where: { company: { id: companyId } },
      relations: { company: true },
    });

    const notices = await this.noticeRepository.find({
      where: { id: In(noticeIds) },
    });

    for (const notice of notices) {
      await this.scoringPersistence.evaluateAndPersist(company, notice, companyContracts);
    }

    return { processed: true, noticesMatched: notices.length };
  }

  /**
   * Processes the standard scoring-dispatch job type.
   */
  private async processScoringDispatch(
    job: Job<ScoringDispatchJobData>,
  ): Promise<{ processed: true; companiesMatched: number }> {
    const { procurementNoticeId, secopId } = job.data;
    this.logger.log(`Processing scoring match for notice ${procurementNoticeId} (${secopId})`);

    const notice = await this.fetchAndTransitionNotice(procurementNoticeId);

    const { companies, allContracts } = await this.fetchCompaniesAndContracts();
    const contractsByCompanyId = this.groupContractsByCompany(allContracts);

    for (const company of companies) {
      const companyContracts = contractsByCompanyId[company.id] || [];
      await this.scoringPersistence.evaluateAndPersist(company, notice, companyContracts);
    }

    this.logger.log(`Completed matching for notice ${procurementNoticeId} against ${companies.length} companies`);
    return { processed: true, companiesMatched: companies.length };
  }

  // ── Data-fetching helpers ─────────────────────────────────────

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

  // ── Lifecycle hooks ───────────────────────────────────────────

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`Scoring job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Scoring job ${job.id} failed: ${error.message}`);
  }
}
