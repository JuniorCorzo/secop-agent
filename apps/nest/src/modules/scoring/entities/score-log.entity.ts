import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { ProcurementNotice } from '../../procurement-notices/entities/procurement-notice.entity';

/**
 * Persisted representation of historical score logs.
 */
@Entity({ name: 'score_logs' })
@Index('IDX_score_logs_company_id', ['company'])
@Index('IDX_score_logs_notice_id', ['notice'])
export class ScoreLog {
  /**
   * Unique identifier of the score log.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * The company involved in this evaluation.
   */
  @ManyToOne(() => Company, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  /**
   * The procurement notice involved in this evaluation.
   */
  @ManyToOne(() => ProcurementNotice, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'notice_id' })
  notice: ProcurementNotice;

  /**
   * The calculated total score between 0 and 100.
   */
  @Column({ name: 'total_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  totalScore: number;

  /**
   * The band category: e.g. VIABLE, REVISAR, BAJA_PRIORIDAD, or EXCLUIDO.
   */
  @Column({ type: 'varchar', length: 20, nullable: false })
  category: string;

  /**
   * Detailed breakdown of the scoring.
   */
  @Column({ type: 'jsonb', nullable: true })
  breakdown: Record<string, any>;

  /**
   * Natural language justification explanation for the score or exclusion.
   */
  @Column({ type: 'text', nullable: true })
  explanation: string;

  /**
   * RAG evidence placeholder.
   */
  @Column({ name: 'rag_evidence', type: 'jsonb', nullable: true })
  ragEvidence: Record<string, any>;

  /**
   * Hard filters results.
   */
  @Column({ name: 'filter_result', type: 'jsonb', nullable: true })
  filterResult: Record<string, any>;

  /**
   * LLM model version.
   */
  @Column({ name: 'model_version', type: 'varchar', length: 50, nullable: true })
  modelVersion: string;

  /**
   * The date and time when the score log record was created.
   */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
