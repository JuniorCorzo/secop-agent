import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { CreateProcurementNoticeDto } from '../../procurement-notices/dto/create-procurement-notice.dto';
import { ProcurementNoticesService } from '../../procurement-notices/services/procurement-notices.service';
import { sodaConfig } from '../../../config/soda.config';
import { mapSecopI } from '../mappers/secop-i.mapper';
import { mapSecopII } from '../mappers/secop-ii.mapper';
import {
  DatasetFailureState,
  SecopIRecord,
  SecopIIRecord,
} from '../soda-ingestion.types';
import { SodaClientService } from './soda-client.service';

type DatasetSource = 'SECOP_I' | 'SECOP_II';

@Injectable()
export class SodaIngestionService {
  private readonly logger = new Logger(SodaIngestionService.name);
  private readonly config;
  private isRunning = false;
  private readonly failureState = new Map<DatasetSource, DatasetFailureState>([
    ['SECOP_I', { consecutiveFailures: 0, lastRunTimestamp: null }],
    ['SECOP_II', { consecutiveFailures: 0, lastRunTimestamp: null }],
  ]);

  constructor(
    private readonly configService: ConfigService,
    private readonly sodaClientService: SodaClientService,
    private readonly procurementNoticesService: ProcurementNoticesService,
  ) {
    this.config = sodaConfig({
      SODA_API_URL: this.configService.get('SODA_API_URL'),
      SODA_APP_TOKEN: this.configService.get('SODA_APP_TOKEN'),
      SODA_DATASET_SECOP1: this.configService.get('SODA_DATASET_SECOP1'),
      SODA_DATASET_SECOP2: this.configService.get('SODA_DATASET_SECOP2'),
      SODA_PAGE_SIZE: this.configService.get('SODA_PAGE_SIZE'),
      SODA_CRON: this.configService.get('SODA_CRON'),
    });
  }

  @Cron(process.env.SODA_CRON ?? '0 */6 * * *')
  async handleCron(): Promise<void> {
    await this.runIngestionCycle();
  }

  async runIngestionCycle(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Skipping SODA ingestion cycle because previous cycle is still running');
      return;
    }

    this.isRunning = true;

    try {
      await Promise.allSettled([
        this.fetchAndIngest<SecopIRecord>(this.config.datasetSecop1, 'SECOP_I'),
        this.fetchAndIngest<SecopIIRecord>(this.config.datasetSecop2, 'SECOP_II'),
      ]);
    } finally {
      this.isRunning = false;
    }
  }

  async fetchAndIngest<TRecord>(datasetId: string, source: DatasetSource): Promise<void> {
    try {
      const whereClause = this.buildWhereClause(source);
      const records = await this.sodaClientService.paginateDataset<TRecord>(datasetId, whereClause);
      const mapped = records.map((record) => this.mapRecord(record, source));

      for (let index = 0; index < mapped.length; index += 500) {
        const batch = mapped.slice(index, index + 500);
        await this.procurementNoticesService.bulkUpsert(batch);
      }

      this.failureState.set(source, {
        consecutiveFailures: 0,
        lastRunTimestamp: new Date().toISOString(),
      });
    } catch (error) {
      const current = this.failureState.get(source) ?? {
        consecutiveFailures: 0,
        lastRunTimestamp: null,
      };
      const nextFailures = current.consecutiveFailures + 1;

      this.failureState.set(source, {
        consecutiveFailures: nextFailures,
        lastRunTimestamp: current.lastRunTimestamp,
      });

      const message = error instanceof Error ? error.message : String(error);
      if (nextFailures >= 3) {
        this.logger.error(
          `Dataset ${source} accumulated ${nextFailures} consecutive failures: ${message}`,
        );
      } else {
        this.logger.warn(`Dataset ${source} failed: ${message}`);
      }
    }
  }

  buildWhereClause(source: DatasetSource): string | undefined {
    const state = this.failureState.get(source);
    if (!state?.lastRunTimestamp) {
      return undefined;
    }

    const fieldName = source === 'SECOP_I' ? 'ultima_actualizacion' : 'fecha_de_ultima_publicaci';
    return `${fieldName} > '${state.lastRunTimestamp}'`;
  }

  private mapRecord(record: unknown, source: DatasetSource): CreateProcurementNoticeDto {
    return source === 'SECOP_I'
      ? mapSecopI(record as SecopIRecord)
      : mapSecopII(record as SecopIIRecord);
  }
}
