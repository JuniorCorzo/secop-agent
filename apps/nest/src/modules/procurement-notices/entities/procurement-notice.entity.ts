import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'procurement_notices' })
@Index('UQ_procurement_notices_secop_id', ['secopId'], { unique: true })
export class ProcurementNotice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'secop_id', type: 'varchar', length: 64, nullable: false })
  secopId: string;

  @Column({ type: 'varchar', length: 512, nullable: false })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  status: string | null;

  @Column({ name: 'entity_name', type: 'varchar', length: 512, nullable: true })
  entityName: string | null;

  @Column({ name: 'contact_info', type: 'text', nullable: true })
  contactInfo: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  value: number | null;

  @Column({ type: 'varchar', length: 8, nullable: true })
  currency: string | null;

  @Column({ name: 'publication_date', type: 'date', nullable: true })
  publicationDate: Date | null;

  @Column({ name: 'deadline_date', type: 'date', nullable: true })
  deadlineDate: Date | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  sector: string | null;

  @Column({ type: 'varchar', length: 256, nullable: true })
  location: string | null;

  @Column({ name: 'source_metadata', type: 'jsonb', nullable: true })
  sourceMetadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
