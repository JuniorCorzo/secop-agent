import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const IngestionJobStatus = {
  ACCEPTED: 'ACCEPTED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
} as const;

export type IngestionJobStatus =
  (typeof IngestionJobStatus)[keyof typeof IngestionJobStatus];

@Entity({ name: 'ingestion_jobs' })
export class IngestionJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64, nullable: false })
  status: IngestionJobStatus = IngestionJobStatus.ACCEPTED;

  @Column({ name: 'secop_id', type: 'varchar', length: 64, nullable: true })
  secopId: string | null;

  @Column({ name: 'created_count', type: 'integer', nullable: false, default: 0 })
  createdCount = 0;

  @Column({ name: 'updated_count', type: 'integer', nullable: false, default: 0 })
  updatedCount = 0;

  @Column({ name: 'failed_count', type: 'integer', nullable: false, default: 0 })
  failedCount = 0;

  @Column({ type: 'jsonb', nullable: false, default: () => "'[]'::jsonb" })
  errors: Array<{ secopId: string; reason: string }> = [];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
