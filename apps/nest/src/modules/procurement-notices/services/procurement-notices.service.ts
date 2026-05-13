import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ProcurementNotice } from '../entities/procurement-notice.entity';
import { CreateProcurementNoticeDto } from '../dto/create-procurement-notice.dto';
import { UpdateProcurementNoticeDto } from '../dto/update-procurement-notice.dto';
import { SearchProcurementNoticeDto } from '../dto/search-procurement-notice.dto';
import {
  ProcurementNoticeSortBy,
  ProcurementNoticeSortOrder,
  ProcurementNoticeStatus,
  canTransitionProcurementNoticeStatus,
  isProcurementNoticeStatus,
} from '../procurement-notice.types';

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

export interface BulkIngestResult {
  created: number;
  duplicates: number;
  invalid: number;
}

const DEFAULT_STATUS: ProcurementNoticeStatus = 'PENDING';

@Injectable()
export class ProcurementNoticesService {
  constructor(
    @InjectRepository(ProcurementNotice)
    private readonly repository: Repository<ProcurementNotice>,
  ) {}

  async create(dto: CreateProcurementNoticeDto): Promise<ProcurementNotice> {
    const entity = this.repository.create({
      ...dto,
      status: dto.status ?? DEFAULT_STATUS,
      publicationDate: dto.publicationDate ? new Date(dto.publicationDate) : undefined,
      deadlineDate: dto.deadlineDate ? new Date(dto.deadlineDate) : undefined,
    });

    try {
      return await this.repository.save(entity);
    } catch (error: unknown) {
      this.throwConflictIfDuplicate(error);
      throw error;
    }
  }

  async findOne(id: string): Promise<ProcurementNotice> {
    const entity = await this.repository.findOne({ where: { id } });
    if (!entity) {
      throw new NotFoundException('Procurement notice not found');
    }
    return entity;
  }

  async findBySecopId(secopId: string): Promise<ProcurementNotice> {
    const entity = await this.repository.findOne({ where: { secopId } });
    if (!entity) {
      throw new NotFoundException('Procurement notice not found');
    }
    return entity;
  }

  async update(id: string, dto: UpdateProcurementNoticeDto): Promise<ProcurementNotice> {
    const entity = await this.findOne(id);
    const updated = this.repository.merge(entity, {
      ...dto,
      status: dto.status ?? entity.status ?? DEFAULT_STATUS,
      publicationDate: dto.publicationDate ? new Date(dto.publicationDate) : entity.publicationDate,
      deadlineDate: dto.deadlineDate ? new Date(dto.deadlineDate) : entity.deadlineDate,
    });
    return this.repository.save(updated);
  }

  async remove(id: string): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.softRemove(entity);
  }

  async search(dto: SearchProcurementNoticeDto): Promise<SearchResult> {
    return this.findAll(dto);
  }

  async findAll(dto: SearchProcurementNoticeDto): Promise<SearchResult> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortBy = dto.sortBy ?? 'createdAt';
    const order = dto.order ?? 'DESC';

    const qb = this.repository.createQueryBuilder('notice');

    if (dto.query) {
      qb.andWhere(
        '(notice.title ILIKE :query OR notice.secopId ILIKE :query OR notice.entityName ILIKE :query OR notice.sector ILIKE :query OR notice.location ILIKE :query)',
        { query: `%${dto.query}%` },
      );
    }

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
      .orderBy(`notice.${sortBy as ProcurementNoticeSortBy}`, order as ProcurementNoticeSortOrder)
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

  async transitionLifecycle(
    id: string,
    targetStatus: ProcurementNoticeStatus,
  ): Promise<ProcurementNotice> {
    const entity = await this.findOne(id);
    const currentStatus = isProcurementNoticeStatus(entity.status) ? entity.status : DEFAULT_STATUS;

    if (!canTransitionProcurementNoticeStatus(currentStatus, targetStatus)) {
      throw new BadRequestException(
        `Cannot transition procurement notice from ${currentStatus} to ${targetStatus}`,
      );
    }

    entity.status = targetStatus;
    return this.repository.save(entity);
  }

  async bulkIngest(records: CreateProcurementNoticeDto[]): Promise<BulkIngestResult> {
    const deduplicated = new Map<string, CreateProcurementNoticeDto>();
    let duplicates = 0;

    for (const record of records) {
      if (deduplicated.has(record.secopId)) {
        duplicates++;
      }
      deduplicated.set(record.secopId, record);
    }

    const uniqueRecords = Array.from(deduplicated.values());
    const existingEntities =
      uniqueRecords.length > 0
        ? await this.repository.find({
            where: uniqueRecords.map((record) => ({ secopId: record.secopId })),
            select: ['secopId'],
          })
        : [];
    const existingSet = new Set(existingEntities.map((entity) => entity.secopId));

    const entities = uniqueRecords.map((dto) => ({
      ...dto,
      status: dto.status ?? DEFAULT_STATUS,
      publicationDate: dto.publicationDate ? new Date(dto.publicationDate) : null,
      deadlineDate: dto.deadlineDate ? new Date(dto.deadlineDate) : null,
      description: dto.description ?? null,
      entityName: dto.entityName ?? null,
      contactInfo: dto.contactInfo ?? null,
      value: dto.value ?? null,
      currency: dto.currency ?? null,
      sector: dto.sector ?? null,
      location: dto.location ?? null,
      sourceMetadata: dto.sourceMetadata ?? null,
    }));

    for (let index = 0; index < entities.length; index += 50) {
      await this.repository.upsert(entities.slice(index, index + 50) as any, ['secopId']);
    }

    return {
      created: uniqueRecords.filter((record) => !existingSet.has(record.secopId)).length,
      duplicates: duplicates + existingSet.size,
      invalid: 0,
    };
  }

  private throwConflictIfDuplicate(error: unknown): void {
    const code = this.extractErrorCode(error);
    if (code === '23505') {
      throw new ConflictException('Procurement notice already exists for that SECOP identifier');
    }

    if (error instanceof QueryFailedError && this.extractErrorCode(error.driverError) === '23505') {
      throw new ConflictException('Procurement notice already exists for that SECOP identifier');
    }
  }

  private extractErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== 'object') {
      return undefined;
    }

    const maybeCode = (error as { code?: unknown }).code;
    return typeof maybeCode === 'string' ? maybeCode : undefined;
  }
}
