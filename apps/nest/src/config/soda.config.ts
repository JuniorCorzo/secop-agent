import type { EnvironmentConfig } from "./env.validation";

export interface SodaConfig {
	apiUrl: string;
	appToken: string;
	datasetSecop1: string;
	datasetSecop2: string;
	pageSize: number;
	maxPages: number | null;
	cron: string;
	/** ISO 8601 — only fetch records with ordering field > this date */
	since: string | null;
}

/**
 * SODA ingestion configuration factory.
 * Reads SODA-specific env vars with safe defaults for local development.
 *
 * SODA_MAX_PAGES: limits pagination to N pages (dev only). null = fetch all.
 * Default in development: 1 page × 500 records = 500 records per dataset.
 */
export const sodaConfig = (
	env: Pick<
		EnvironmentConfig,
		| "SODA_API_URL"
		| "SODA_APP_TOKEN"
		| "SODA_DATASET_SECOP1"
		| "SODA_DATASET_SECOP2"
		| "SODA_PAGE_SIZE"
		| "SODA_MAX_PAGES"
		| "SODA_CRON"
		| "SODA_SINCE"
	>,
): SodaConfig => ({
	apiUrl: env.SODA_API_URL ?? "https://www.datos.gov.co",
	appToken: env.SODA_APP_TOKEN ?? "",
	datasetSecop1: env.SODA_DATASET_SECOP1 ?? "f789-7hwg",
	datasetSecop2: env.SODA_DATASET_SECOP2 ?? "p6dx-8zbt",
	pageSize: env.SODA_PAGE_SIZE ?? 500,
	maxPages: env.SODA_MAX_PAGES ?? null,
	cron: env.SODA_CRON ?? "0 */6 * * *",
	since: env.SODA_SINCE ?? null,
});
