import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { ProcurementNotice } from '../../procurement-notices/entities/procurement-notice.entity';

/**
 * Represents the evaluation and matching result of a company against a procurement notice.
 */
@Entity({ name: 'matching_results' })
@Index('IDX_matching_results_company_id', ['company'])
@Index('IDX_matching_results_notice_id', ['notice'])
export class MatchingResult {
  /**
   * Unique identifier of the matching result.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The status of the match: 'EXCLUDED' if it failed hard filters, or 'PASSED' otherwise.
   */
  @Column({ type: 'varchar', length: 20, nullable: false })
  status: 'EXCLUDED' | 'PASSED';

  /**
   * The calculated affinity score between 0 and 100.
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  score: number;

  /**
   * Detailed breakdown of the matching vectors (e.g., technical, economic, experience, geographic fits).
   */
  @Column({ name: 'vector_breakdown', type: 'jsonb', nullable: true })
  vectorBreakdown: Record<string, any>;

  /**
   * Natural language justification explanation for the score or exclusion.
   */
  @Column({ type: 'text', nullable: true })
  justification: string;

  /**
   * The company involved in this match.
   */
  @ManyToOne(() => Company, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  /**
   * The procurement notice involved in this match.
   */
  @ManyToOne(() => ProcurementNotice, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'notice_id' })
  notice: ProcurementNotice;

  /**
   * The date and time when the matching result record was created.
   */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /**
   * The date and time when the matching result record was last updated.
   */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
