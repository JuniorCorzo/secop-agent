import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MatchingResult } from '../entities/matching-result.entity';
import { ScoreLog } from '../entities/score-log.entity';

/**
 * Service responsible for retrieving scoring data for companies and notices.
 */
@Injectable()
export class ScoringQueryService {
  constructor(
    @InjectRepository(MatchingResult)
    private readonly matchingResultRepository: Repository<MatchingResult>,
    @InjectRepository(ScoreLog)
    private readonly scoreLogRepository: Repository<ScoreLog>,
  ) {}

  /**
   * Returns the latest matching result for a company–notice pair.
   *
   * @param companyId - UUID of the company.
   * @param noticeId - UUID of the procurement notice.
   * @returns The most recent {@link MatchingResult} including its linked entities.
   * @throws NotFoundException if no result exists for the given pair.
   */
  async getLatestResult(companyId: string, noticeId: string): Promise<MatchingResult> {
    const result = await this.matchingResultRepository.findOne({
      where: {
        company: { id: companyId },
        notice: { id: noticeId },
      },
      relations: { company: true, notice: true },
    });

    if (!result) {
      throw new NotFoundException(
        `No scoring result found for company ${companyId} and notice ${noticeId}`,
      );
    }

    return result;
  }

  /**
   * Returns the category band of the latest score for a company–notice pair.
   *
   * The category is derived from the most recently created {@link ScoreLog} entry.
   *
   * @param companyId - UUID of the company.
   * @param noticeId - UUID of the procurement notice.
   * @returns The latest {@link ScoreLog} entry, or null if none exists.
   */
  async getLatestScoreLog(companyId: string, noticeId: string): Promise<ScoreLog | null> {
    const [log] = await this.scoreLogRepository.find({
      where: {
        company: { id: companyId },
        notice: { id: noticeId },
      },
      relations: { company: true, notice: true },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    return log ?? null;
  }
}
