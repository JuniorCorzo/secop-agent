import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../queues/constants/queue-names';
import { ScoringDispatchJobData } from '../../queues/producers/scoring-dispatch.producer';
import { CompanyScoringBatchJobData } from '../../queues/producers/company-scoring-batch.producer';
import { ProcurementNotice } from '../../procurement-notices/entities/procurement-notice.entity';
import { Company } from '../../companies/entities/company.entity';
import { CompanyContract } from '../../companies/entities/company-contract.entity';
import { MatchingResult } from '../entities/matching-result.entity';
import { ScoreLog } from '../entities/score-log.entity';
import { HardFiltersService } from '../services/hard-filters.service';
import { ScoringEngineService } from '../services/scoring-engine.service';
import { LLM_PROVIDER } from '../../llm/llm.module';
import { LlmProvider } from '../../llm/interfaces/llm-provider.interface';

/**
 * BullMQ background worker that processes scoring dispatch and batch scoring jobs.
 */
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
    @InjectRepository(ScoreLog)
    private readonly scoreLogRepository: Repository<ScoreLog>,
    private readonly hardFiltersService: HardFiltersService,
    private readonly scoringEngineService: ScoringEngineService,
    @Inject(LLM_PROVIDER)
    private readonly llmProvider: LlmProvider,
  ) {
    super();
  }

  /**
   * Main entry point to process a scoring job.
   */
  async process(job: Job<any>): Promise<any> {
    if (job.name === 'company-batch-scoring') {
      return this.processCompanyBatchScoring(job);
    } else {
      return this.processScoringDispatch(job);
    }
  }

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
      await this.evaluateAndPersist(company, notice, companyContracts);
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
      await this.evaluateAndPersist(company, notice, companyContracts);
    }

    this.logger.log(`Completed matching for notice ${procurementNoticeId} against ${companies.length} companies`);
    return { processed: true, companiesMatched: companies.length };
  }

  /**
   * Evaluates hard filters, calculates score, gets LLM narrative explanation and persists results.
   */
  private async evaluateAndPersist(
    company: Company,
    notice: ProcurementNotice,
    companyContracts: CompanyContract[],
  ): Promise<void> {
    const filterResult = this.hardFiltersService.evaluate(company, notice, companyContracts);

    let status: 'PASSED' | 'EXCLUDED';
    let score = 0;
    let category: 'VIABLE' | 'REVISAR' | 'BAJA_PRIORIDAD' | 'EXCLUIDO';
    let breakdown: Record<string, any> = {};
    let justification = filterResult.justification;

    if (!filterResult.passed) {
      status = 'EXCLUDED';
      score = 0;
      category = 'EXCLUIDO';
      breakdown = {};
    } else {
      status = 'PASSED';
      const scoreResult = this.scoringEngineService.computeScore(company, notice, companyContracts);
      score = scoreResult.score;
      category = score >= 70 ? 'VIABLE' : score >= 40 ? 'REVISAR' : 'BAJA_PRIORIDAD';
      breakdown = scoreResult.vectorBreakdown;
      justification = scoreResult.justification;
    }

    let explanation = justification;
    if (category !== 'EXCLUIDO' && this.llmProvider) {
      try {
        const messages = [
          {
            role: 'system',
            content: 'Eres un asistente analista experto en compras públicas colombianas (SECOP). Genera una breve justificación narrativa en español explicando la viabilidad del contrato para la empresa basándote en los datos provistos.',
          },
          {
            role: 'user',
            content: `Empresa: ${company.name}\nConvocatoria: ${notice.title || notice.secopId}\nScore: ${score}\nCategoría: ${category}\nDesglose: ${JSON.stringify(breakdown)}`,
          },
        ];
        const response = await this.llmProvider.chat(messages, { timeout: 5000 });
        if (response?.content) {
          explanation = response.content;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to generate LLM explanation for company ${company.id} and notice ${notice.id}: ${error.message}. Falling back to default justification.`,
        );
      }
    }

    // Upsert MatchingResult
    let matchingResult = await this.matchingResultRepository.findOne({
      where: { company: { id: company.id }, notice: { id: notice.id } },
    });
    if (!matchingResult) {
      matchingResult = this.matchingResultRepository.create({
        company,
        notice,
      });
    }
    matchingResult.status = status;
    matchingResult.score = score;
    matchingResult.vectorBreakdown = breakdown;
    matchingResult.justification = justification;
    await this.matchingResultRepository.save(matchingResult);

    // Append ScoreLog
    const scoreLog = this.scoreLogRepository.create({
      company,
      notice,
      totalScore: score,
      category,
      breakdown,
      explanation,
      filterResult: {
        passed: filterResult.passed,
        justification: filterResult.justification,
        reason: filterResult.reason,
      },
      modelVersion: '1.0.0',
    });
    await this.scoreLogRepository.save(scoreLog);
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

  @OnWorkerEvent('completed')
  onCompleted(job: Job): void {
    this.logger.log(`Scoring job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error(`Scoring job ${job.id} failed: ${error.message}`);
  }
}
