import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Represents a registered company in the system, holding its identification,
 * financial capacities, preferences, and geographical coverage.
 */
@Entity({ name: 'companies' })
@Index('UQ_companies_nit', ['nit'], { unique: true })
export class Company {
  /**
   * Unique identifier of the company.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Tax identification number (NIT) of the company.
   */
  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  nit: string;

  /**
   * Legal name of the company.
   */
  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  /**
   * List of UNSPSC sector codes/categories the company operates in.
   */
  @Column({ type: 'text', array: true, default: '{}' })
  sectors: string[];

  /**
   * List of department/regional codes of geographical coverage.
   */
  @Column({ type: 'text', array: true, default: '{}' })
  regions: string[];

  // Financial indicators
  /**
   * Liquidity ratio financial indicator.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  liquidity: number;

  /**
   * Indebtedness ratio financial indicator.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  indebtedness: number;

  /**
   * Interest coverage ratio financial indicator.
   */
  @Column({ name: 'interest_coverage', type: 'decimal', precision: 10, scale: 2, default: 0 })
  interestCoverage: number;

  // Technical/Organizational capacity
  /**
   * Maximum contracting capacity in COP.
   */
  @Column({ name: 'contracting_capacity', type: 'decimal', precision: 18, scale: 2, default: 0 })
  contractingCapacity: number;

  /**
   * Target contract budget or ticket size the company is interested in.
   */
  @Column({ name: 'target_ticket', type: 'decimal', precision: 18, scale: 2, default: 0 })
  targetTicket: number;

  /**
   * Total working capital of the company.
   */
  @Column({ name: 'working_capital', type: 'decimal', precision: 18, scale: 2, default: 0 })
  workingCapital: number;

  /**
   * Annual revenue of the company.
   */
  @Column({ name: 'annual_revenue', type: 'decimal', precision: 18, scale: 2, default: 0 })
  annualRevenue: number;

  /**
   * List of contract types to exclude from matching.
   */
  @Column({ name: 'excluded_contract_types', type: 'text', array: true, default: '{}' })
  excludedContractTypes: string[];

  /**
   * List of contracting modalities to exclude from matching.
   */
  @Column({ name: 'excluded_modalities', type: 'text', array: true, default: '{}' })
  excludedModalities: string[];

  /**
   * UNSPSC match policy: 'strict' or 'flexible'.
   */
  @Column({ name: 'unspsc_match_policy', type: 'varchar', length: 20, default: 'strict' })
  unspscMatchPolicy: string;

  /**
   * The date and time when the company record was created.
   */
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  /**
   * The date and time when the company record was last updated.
   */
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

