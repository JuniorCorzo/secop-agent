import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from './entities/company.entity';
import { CompanyContract } from './entities/company-contract.entity';
import { CompaniesService } from './services/companies.service';
import { CompaniesController } from './controllers/companies.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Company, CompanyContract])],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService, TypeOrmModule],
})
/**
 * Module responsible for managing companies and their related contracts.
 * Registers TypeORM entities for Company and CompanyContract, and exports CompaniesService.
 */
export class CompaniesModule {}

