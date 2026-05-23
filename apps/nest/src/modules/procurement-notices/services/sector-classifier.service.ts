import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SectorKeyword } from '../entities/sector-keyword.entity';
import { classify, type ClassificationResult } from '../utils/sector-classifier.utils';

export { type ClassificationResult, type SectorScore } from '../utils/sector-classifier.utils';

/**
 * NestJS service wrapping the keyword scoring algorithm.
 *
 * Provides DI-friendly access to sector classification by loading the full
 * `sector_keywords` catalog from the database and delegating to the pure
 * {@link classify} function.
 *
 * @see sector-classification spec
 */
@Injectable()
export class SectorClassifierService {
  constructor(
    @InjectRepository(SectorKeyword)
    private readonly sectorKeywordRepository: Repository<SectorKeyword>,
  ) {}

  /**
   * Loads all sector keywords from the DB and classifies the given title.
   *
   * @param title - The procurement notice title to classify.
   * @returns Classification result with winning sector and all scores.
   */
  async classifyTitle(title: string): Promise<ClassificationResult> {
    const keywords = await this.sectorKeywordRepository.find();
    return classify(title, keywords);
  }

  /**
   * Loads all sector keywords from the DB once and returns them.
   * Used by callers that need to batch-classify multiple notices.
   */
  async loadKeywords(): Promise<SectorKeyword[]> {
    return this.sectorKeywordRepository.find();
  }
}
