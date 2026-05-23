import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'companies' })
@Index('UQ_companies_nit', ['nit'], { unique: true })
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true, nullable: false })
  nit: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  name: string;

  @Column({ type: 'text', array: true, default: '{}' })
  sectors: string[];

  @Column({ type: 'text', array: true, default: '{}' })
  regions: string[];

  // Financial indicators
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  liquidity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  indebtedness: number;

  @Column({ name: 'interest_coverage', type: 'decimal', precision: 10, scale: 2, default: 0 })
  interestCoverage: number;

  // Technical/Organizational capacity
  @Column({ name: 'contracting_capacity', type: 'decimal', precision: 18, scale: 2, default: 0 })
  contractingCapacity: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
