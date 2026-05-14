import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProcurementNoticeStatus } from '../procurement-notice.types';

/**
 * Persisted representation of a SECOP procurement notice.
 *
 * Mapped to the `procurement_notices` table. Uses soft delete (`deletedAt` timestamp)
 * so historical records remain queryable. The `secopId` is the stable external identifier
 * from Colombia's SECOP system and is enforced as a unique constraint.
 *
 * @see procnotices-spec - Persisted Procurement Notice Record
 */
@Entity({ name: 'procurement_notices' })
@Index('UQ_procurement_notices_secop_id', ['secopId'], { unique: true })
export class ProcurementNotice {
  /** Internal UUID primary key — never exposed as a business identifier. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stable SECOP identifier from the Colombian procurement system. Unique across all records. */
  @Column({ name: 'secop_id', type: 'varchar', length: 64, nullable: false })
  secopId: string;

  /** Human-readable notice title. Required. */
  @Column({ type: 'varchar', length: 512, nullable: false })
  title: string;

  /** Full text description of the procurement notice. */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Current lifecycle state. Defaults to `PENDING` on creation.
   * Transitions are validated by {@link canTransitionProcurementNoticeStatus}.
   */
  @Column({
    type: 'varchar',
    length: 64,
    nullable: false,
    default: 'PENDING',
  })
  status: ProcurementNoticeStatus;

  /** Name of the contracting entity or government body. */
  @Column({ name: 'entity_name', type: 'varchar', length: 512, nullable: true })
  entityName: string | null;

  /** Contact details (email, phone, address) for the contracting entity. */
  @Column({ name: 'contact_info', type: 'text', nullable: true })
  contactInfo: string | null;

  /** Estimated contract value. Stored as `decimal(18,2)` to avoid floating-point imprecision. */
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  value: number | null;

  /** ISO 4217 currency code (e.g., `COP`, `USD`). */
  @Column({ type: 'varchar', length: 8, nullable: true })
  currency: string | null;

  /** Date the notice was officially published by the contracting entity. */
  @Column({ name: 'publication_date', type: 'date', nullable: true })
  publicationDate: Date | null;

  /** Submission deadline for proposals. */
  @Column({ name: 'deadline_date', type: 'date', nullable: true })
  deadlineDate: Date | null;

  /** Sector classification (e.g., `IT`, `Construction`, `Health`). */
  @Column({ type: 'varchar', length: 256, nullable: true })
  sector: string | null;

  /** Geographic location of the procurement (e.g., `Bogotá`, `Antioquia`). */
  @Column({ type: 'varchar', length: 256, nullable: true })
  location: string | null;

  /** Raw metadata from the SECOP source (JSON). Preserves original API response for later enrichment. */
  @Column({ name: 'source_metadata', type: 'jsonb', nullable: true })
  sourceMetadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /**
   * Soft delete timestamp. When set, the record is excluded from default queries.
   * Use {@link Repository.softDelete} or query with `withDeleted: true` to include.
   */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
