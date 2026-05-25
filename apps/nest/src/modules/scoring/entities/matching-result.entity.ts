import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Company } from '../../companies/entities/company.entity';
import { ProcurementNotice } from '../../procurement-notices/entities/procurement-notice.entity';

@Entity({ name: 'matching_results' })
@Index('IDX_matching_results_company_id', ['company'])
@Index('IDX_matching_results_notice_id', ['notice'])
export class MatchingResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  status: 'EXCLUDED' | 'PASSED';

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  score: number;

  @Column({ name: 'vector_breakdown', type: 'jsonb', nullable: true })
  vectorBreakdown: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  justification: string;

  @ManyToOne(() => Company, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @ManyToOne(() => ProcurementNotice, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'notice_id' })
  notice: ProcurementNotice;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
