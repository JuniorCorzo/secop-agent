import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Company } from '../../companies/entities/company.entity';
import type { CompanyContract } from '../../companies/entities/company-contract.entity';
import type { ProcurementNotice } from '../../procurement-notices/entities/procurement-notice.entity';
import { MatchingResult } from '../entities/matching-result.entity';
import { ScoreLog } from '../entities/score-log.entity';
import type { HardFiltersService } from './hard-filters.service';
import type { ScoringEngineService } from './scoring-engine.service';
import { LLM_PROVIDER } from '../../llm/llm.module';
import type { LlmProvider } from '../../llm/interfaces/llm-provider.interface';

/**
 * Service responsible for the full scoring persistence pipeline:
 * hard filters → scoring engine → LLM explanation → upsert MatchingResult → append ScoreLog.
 *
 * Extracted from ScoringWorker to comply with Single Responsibility Principle.
 */
@Injectable()
export class ScoringPersistenceService {
  private readonly logger = new Logger(ScoringPersistenceService.name);

  constructor(
    @InjectRepository(MatchingResult)
    private readonly matchingResultRepository: Repository<MatchingResult>,
    @InjectRepository(ScoreLog)
    private readonly scoreLogRepository: Repository<ScoreLog>,
    private readonly hardFiltersService: HardFiltersService,
    private readonly scoringEngineService: ScoringEngineService,
    @Inject(LLM_PROVIDER)
    private readonly llmProvider: LlmProvider,
  ) {}

  /**
   * Evaluates hard filters, calculates score, gets LLM narrative explanation and persists results.
   *
   * @param company - The company to evaluate.
   * @param notice - The procurement notice to match against.
   * @param companyContracts - The company's active contracts for capacity calculation.
   */
  async evaluateAndPersist(
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

    await this.upsertMatchingResult(company, notice, status, score, breakdown, justification);
    await this.appendScoreLog(company, notice, score, category, breakdown, explanation, filterResult);
  }

  /**
   * Upserts a MatchingResult record for the given company-notice pair.
   */
  private async upsertMatchingResult(
    company: Company,
    notice: ProcurementNotice,
    status: 'PASSED' | 'EXCLUDED',
    score: number,
    vectorBreakdown: Record<string, any>,
    justification: string,
  ): Promise<void> {
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
    matchingResult.vectorBreakdown = vectorBreakdown;
    matchingResult.justification = justification;
    await this.matchingResultRepository.save(matchingResult);
  }

  /**
   * Appends a ScoreLog record for audit trail.
   */
  private async appendScoreLog(
    company: Company,
    notice: ProcurementNotice,
    totalScore: number,
    category: string,
    breakdown: Record<string, any>,
    explanation: string,
    filterResult: { passed: boolean; justification: string; reason?: string },
  ): Promise<void> {
    const scoreLog = this.scoreLogRepository.create({
      company,
      notice,
      totalScore,
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
}
