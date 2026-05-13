import { Injectable } from '@nestjs/common';
import { ProcurementIngestionProducer } from '../../queues/producers/procurement-ingestion.producer';
import { BulkIngestionDto } from '../dto/bulk-ingestion.dto';

@Injectable()
export class ProcurementIngestionService {
  constructor(
    private readonly producer: ProcurementIngestionProducer,
  ) {}

  async enqueueBulkIngestion(dto: BulkIngestionDto): Promise<{ jobId: string }> {
    const job = await this.producer.add({ records: dto.records });
    return { jobId: String(job.id) };
  }
}
