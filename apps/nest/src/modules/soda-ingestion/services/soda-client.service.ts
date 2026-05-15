import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { sodaConfig } from '../../../config/soda.config';
import { SodaPageResponse } from '../soda-ingestion.types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class SodaClientService {
  private readonly logger = new Logger(SodaClientService.name);
  private readonly config;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
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

  buildUrl(datasetId: string): string {
    return `${this.config.apiUrl}/api/v3/views/${datasetId}/query.json`;
  }

  async fetchPage<TRecord>(
    datasetId: string,
    offset: number,
    pageSize: number,
    whereClause?: string,
  ): Promise<TRecord[]> {
    const queryParams = new URLSearchParams({
      '$limit': String(pageSize),
      '$offset': String(offset),
    });

    if (whereClause) {
      queryParams.set('$where', whereClause);
    }

    const url = `${this.buildUrl(datasetId)}?${queryParams.toString()}`;
    const delays = [1000, 2000, 4000];

    for (let attempt = 0; attempt < delays.length; attempt++) {
      try {
        const response = await firstValueFrom(
          this.httpService.get<SodaPageResponse<TRecord> | TRecord[]>(url, {
            headers: {
              'X-App-Token': this.config.appToken,
            },
            timeout: 30000,
          }),
        );

        const payload = response.data;

        if (Array.isArray(payload)) {
          return payload;
        }

        return payload.results ?? payload.data ?? [];
      } catch (error) {
        const isLastAttempt = attempt === delays.length - 1;
        if (isLastAttempt) {
          throw error;
        }

        this.logger.warn(
          `Retrying SODA request for dataset ${datasetId} after attempt ${attempt + 1}`,
        );
        await sleep(delays[attempt]);
      }
    }

    return [];
  }

  async paginateDataset<TRecord>(datasetId: string, whereClause?: string): Promise<TRecord[]> {
    const allRecords: TRecord[] = [];
    let offset = 0;
    let pageSize = this.config.pageSize;

    while (true) {
      const page = await this.fetchPage<TRecord>(datasetId, offset, pageSize, whereClause);
      allRecords.push(...page);

      if (page.length < pageSize) {
        break;
      }

      offset += pageSize;
    }

    return allRecords;
  }
}
