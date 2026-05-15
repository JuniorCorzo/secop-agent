import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcurementIngestionProducer } from '../../queues/producers/procurement-ingestion.producer';
import { BulkIngestionDto } from '../dto/bulk-ingestion.dto';
import { IngestionJob, IngestionJobStatus } from '../entities/ingestion-job.entity';

@Injectable()
export class ProcurementIngestionService {
  constructor(
    private readonly producer: ProcurementIngestionProducer,
    @InjectRepository(IngestionJob)
    private readonly ingestionJobRepository: Repository<IngestionJob>,
  ) {}

  async enqueueBulkIngestion(dto: BulkIngestionDto): Promise<{ jobId: string }> {
    const ingestionJob = this.ingestionJobRepository.create({
      status: IngestionJobStatus.ACCEPTED,
      secopId: null,
      createdCount: 0,
      updatedCount: 0,
      failedCount: 0,
      errors: [],
    });

    const savedJob = await this.ingestionJobRepository.save(ingestionJob);

    await this.producer.add({
      ingestionJobId: savedJob.id,
      records: dto.records,
    });

    return { jobId: savedJob.id };
  }
}
