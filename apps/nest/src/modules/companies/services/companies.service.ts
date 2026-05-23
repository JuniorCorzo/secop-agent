import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../entities/company.entity';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { UpdateCompanyDto } from '../dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companiesRepository: Repository<Company>,
  ) {}

  async findAll(): Promise<Company[]> {
    return this.companiesRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companiesRepository.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException(`Company with ID "${id}" not found`);
    }
    return company;
  }

  async create(dto: CreateCompanyDto): Promise<Company> {
    const existing = await this.companiesRepository.findOne({ where: { nit: dto.nit } });
    if (existing) {
      throw new ConflictException(`Company with NIT "${dto.nit}" already exists`);
    }

    const company = this.companiesRepository.create(dto);
    return this.companiesRepository.save(company);
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(id);

    if (dto.nit && dto.nit !== company.nit) {
      const existing = await this.companiesRepository.findOne({ where: { nit: dto.nit } });
      if (existing) {
        throw new ConflictException(`Company with NIT "${dto.nit}" already exists`);
      }
    }

    Object.assign(company, dto);
    return this.companiesRepository.save(company);
  }

  async remove(id: string): Promise<void> {
    const company = await this.findOne(id);
    await this.companiesRepository.remove(company);
  }
}
