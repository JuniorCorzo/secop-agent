import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcurementNotice } from '../entities/procurement-notice.entity';
import { CreateProcurementNoticeDto } from '../dto/create-procurement-notice.dto';
import { UpdateProcurementNoticeDto } from '../dto/update-procurement-notice.dto';
import { SearchProcurementNoticeDto } from '../dto/search-procurement-notice.dto';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SearchResult {
  data: ProcurementNotice[];
  meta: PaginationMeta;
}

@Injectable()
export class ProcurementNoticesService {
  constructor(
    @InjectRepository(ProcurementNotice)
    private readonly repository: Repository<ProcurementNotice>,
  ) {}

  async create(dto: CreateProcurementNoticeDto): Promise<ProcurementNotice> {
    const entity = this.repository.create({
      ...dto,
      publicationDate: dto.publicationDate ? new Date(dto.publicationDate) : undefined,
      deadlineDate: dto.deadlineDate ? new Date(dto.deadlineDate) : undefined,
    });
    return this.repository.save(entity);
  }

  async findOne(id: string): Promise<ProcurementNotice> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Procurement notice not found');
    }
    return entity;
  }

  async update(id: string, dto: UpdateProcurementNoticeDto): Promise<ProcurementNotice> {
    const entity = await this.findOne(id);
    const updated = this.repository.merge(entity, {
      ...dto,
      publicationDate: dto.publicationDate ? new Date(dto.publicationDate) : entity.publicationDate,
      deadlineDate: dto.deadlineDate ? new Date(dto.deadlineDate) : entity.deadlineDate,
    });
    return this.repository.save(updated);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.remove(entity);
  }

  async search(dto: SearchProcurementNoticeDto): Promise<SearchResult> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repository.createQueryBuilder('notice');

    if (dto.title) {
      qb.andWhere('notice.title ILIKE :title', { title: `%${dto.title}%` });
    }

    if (dto.secopId) {
      qb.andWhere('notice.secopId = :secopId', { secopId: dto.secopId });
    }

    if (dto.entityName) {
      qb.andWhere('notice.entityName ILIKE :entityName', { entityName: `%${dto.entityName}%` });
    }

    if (dto.status) {
      qb.andWhere('notice.status = :status', { status: dto.status });
    }

    if (dto.sector) {
      qb.andWhere('notice.sector ILIKE :sector', { sector: `%${dto.sector}%` });
    }

    if (dto.location) {
      qb.andWhere('notice.location ILIKE :location', { location: `%${dto.location}%` });
    }

    const [data, total] = await qb
      .orderBy('notice.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
