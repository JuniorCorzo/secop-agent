import type { EnvironmentConfig } from './env.validation';

export interface SodaConfig {
  apiUrl: string;
  appToken: string;
  datasetSecop1: string;
  datasetSecop2: string;
  pageSize: number;
  cron: string;
}

/**
 * SODA ingestion configuration factory.
 * Reads SODA-specific env vars with safe defaults for local development.
 */
export const sodaConfig = (
  env: Pick<
    EnvironmentConfig,
    | 'SODA_API_URL'
    | 'SODA_APP_TOKEN'
    | 'SODA_DATASET_SECOP1'
    | 'SODA_DATASET_SECOP2'
    | 'SODA_PAGE_SIZE'
    | 'SODA_CRON'
  >,
): SodaConfig => ({
  apiUrl: env.SODA_API_URL ?? 'https://www.datos.gov.co',
  appToken: env.SODA_APP_TOKEN ?? '',
  datasetSecop1: env.SODA_DATASET_SECOP1 ?? 'f789-7hwg',
  datasetSecop2: env.SODA_DATASET_SECOP2 ?? 'p6dx-8zbt',
  pageSize: env.SODA_PAGE_SIZE ?? 5000,
  cron: env.SODA_CRON ?? '0 */6 * * *',
});
