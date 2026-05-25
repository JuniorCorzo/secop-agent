import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Company } from './company.entity';

/**
 * Represents a contract executed by a company, used for scoring and experience evaluations.
 */
@Entity({ name: 'company_contracts' })
export class CompanyContract {
  /**
   * Unique identifier of the contract.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Description of the contract scope or object.
   */
  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * UNSPSC classification code associated with the contract.
   */
  @Column({ name: 'unspsc_code', type: 'varchar', length: 20, nullable: false })
  unspscCode: string;

  /**
   * Monetary value of the contract in COP.
   */
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: false })
  value: number;

  /**
   * Tax identification number (NIT) of the client organization.
   */
  @Column({ name: 'client_nit', type: 'varchar', length: 50, nullable: false })
  clientNit: string;

  /**
   * Current execution status of the contract (e.g., 'LIQUIDADO', 'EJECUCION').
   */
  @Column({ type: 'varchar', length: 50, nullable: false })
  status: string;

  /**
   * Date when the contract execution started.
   */
  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate: Date;

  /**
   * Date when the contract execution ended or is scheduled to end.
   */
  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate: Date;

  /**
   * The company that executed this contract.
   */
  @ManyToOne(() => Company, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  /**
   * The date and time when the contract record was created.
   */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /**
   * The date and time when the contract record was last updated.
   */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
