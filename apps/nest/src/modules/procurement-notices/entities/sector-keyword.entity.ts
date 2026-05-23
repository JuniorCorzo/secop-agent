import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * Keyword and weight associated with an industry sector.
 *
 * Used by {@link SectorClassifierService} to classify procurement notices via
 * the Keyword Scoring algorithm — matching keywords found in the notice title
 * and accumulating their weights to determine the winning sector.
 *
 * @see sector-classification spec
 */
@Entity({ name: 'sector_keywords' })
@Unique('UQ_sector_keywords_sector_keyword', ['sector', 'keyword'])
export class SectorKeyword {
  /** Internal UUID primary key. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Name of the industry sector (e.g. "SALUD", "TI", "INFRAESTRUCTURA").
   * Stored in uppercase for consistent matching.
   */
  @Column({ type: 'varchar', length: 50, nullable: false })
  sector: string;

  /**
   * Keyword to search for in the normalized notice title.
   * Stored in lowercase for consistent comparison.
   */
  @Column({ type: 'varchar', length: 100, nullable: false })
  keyword: string;

  /**
   * Weight applied when the keyword is found in the title.
   * Higher weights indicate more specific/relevant terms.
   * Range: 0.01 – 9.99.
   */
  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: false })
  weight: number;
}
