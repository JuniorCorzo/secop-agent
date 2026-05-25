import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Company } from './company.entity';

@Entity({ name: 'company_contracts' })
export class CompanyContract {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'unspsc_code', type: 'varchar', length: 20, nullable: false })
  unspscCode: string;

  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: false })
  value: number;

  @Column({ name: 'client_nit', type: 'varchar', length: 50, nullable: false })
  clientNit: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  status: string;

  @Column({ name: 'start_date', type: 'timestamptz', nullable: true })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate: Date;

  @ManyToOne(() => Company, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'company_id' })
  company: Company;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
