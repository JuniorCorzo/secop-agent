import { HttpService } from "@nestjs/axios";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom } from "rxjs";
import { sodaConfig } from "../../../config/soda.config";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── SODA 3.0 request types ────────────────────────────────────

interface SodaQueryRequest {
	/** Full SoQL query string: `SELECT a,b WHERE x > 'y' ORDER BY z ASC` */
	query: string;
	page: {
		pageNumber: number;
		pageSize: number;
	};
	/** Exclude system fields (`:id`, `:created_at`) */
	includeSystem: false;
	/** Exclude columns not explicitly requested in SELECT */
	includeSynthetic: false;
}

interface SodaPageResponse<TRecord> {
	results?: TRecord[];
	data?: TRecord[];
}

export interface SodaQueryPage {
	/** SoQL query string for the page */
	query: string;
	/** Page number (1-indexed). Cursor-based always uses 1. */
	pageNumber: number;
	/** Records expected per page */
	pageSize: number;
}

// ── Service ────────────────────────────────────────────────────

/**
 * Low-level SODA 3.0 HTTP client.
 *
 * **Single responsibility**: sends POST requests with SoQL JSON bodies
 * to the SODA API and returns parsed records. Does NOT build queries,
 * does NOT map records, does NOT know about SECOP.
 *
 * SODA 3.0 requires:
 * - **POST** (not GET)
 * - **JSON body** with `query` (SoQL string) + `page` object
 * - **X-App-Token** header for authentication
 * - `includeSynthetic: false` to avoid returning unrequested columns
 *
 * The `$limit`/`$offset`/`$select`/`$where` query-string params are
 * SODA 2.x legacy and are **ignored** by SODA 3.0 endpoints.
 */
@Injectable()
export class SodaClientService {
	private readonly logger = new Logger(SodaClientService.name);
	private readonly config;

	constructor(
		private readonly httpService: HttpService,
		private readonly configService: ConfigService,
	) {
		this.config = sodaConfig({
			SODA_API_URL: this.configService.get("SODA_API_URL"),
			SODA_APP_TOKEN: this.configService.get("SODA_APP_TOKEN"),
			SODA_DATASET_SECOP1: this.configService.get("SODA_DATASET_SECOP1"),
			SODA_DATASET_SECOP2: this.configService.get("SODA_DATASET_SECOP2"),
			SODA_PAGE_SIZE: this.configService.get("SODA_PAGE_SIZE"),
			SODA_MAX_PAGES: this.configService.get("SODA_MAX_PAGES"),
			SODA_CRON: this.configService.get("SODA_CRON"),
			SODA_SINCE: this.configService.get("SODA_SINCE"),
		});
	}

	// ── Public API ──────────────────────────────────────────────

	/**
	 * Executes a SoQL query against the SODA 3.0 API and returns one page.
	 *
	 * This is the **only** HTTP method — all pagination strategies
	 * (cursor-based, offset-based) are implemented by the caller through
	 * the query string and page number.
	 *
	 * @param datasetId  SODA dataset ID (e.g., "p6dx-8zbt")
	 * @param page       SoQL query + pagination info
	 * @returns Array of records for this page (empty array when no results)
	 */
	async queryDataset<TRecord>(
		datasetId: string,
		page: SodaQueryPage,
	): Promise<TRecord[]> {
		const body: SodaQueryRequest = {
			query: page.query,
			page: {
				pageNumber: page.pageNumber,
				pageSize: page.pageSize,
			},
			includeSystem: false,
			includeSynthetic: false,
		};

		const url = this.buildUrl(datasetId);
		const delays = [100, 300, 700];

		for (let attempt = 0; attempt < delays.length; attempt++) {
			const attemptLabel = `dataset=${datasetId} page=${page.pageNumber} attempt=${attempt + 1}/${delays.length}`;
			this.logger.debug(`POST ${url} [${attemptLabel}]`);
			const reqStart = Date.now();

			try {
				const response = await firstValueFrom(
					this.httpService.post<SodaPageResponse<TRecord> | TRecord[]>(
						url,
						body,
						{
							headers: {
								"Content-Type": "application/json",
								"X-App-Token": this.config.appToken,
							},
							timeout: 30000,
						},
					),
				);

				const elapsed = Date.now() - reqStart;
				const payload = response.data;

				if (Array.isArray(payload)) {
					this.logger.debug(
						`Response ${response.status} — ${payload.length} records in ${elapsed}ms [${attemptLabel}]`,
					);
					return payload;
				}

				const records = payload.results ?? payload.data ?? [];
				this.logger.debug(
					`Response ${response.status} — ${records.length} records in ${elapsed}ms [${attemptLabel}]`,
				);
				return records;
			} catch (error) {
				const elapsed = Date.now() - reqStart;
				const isLastAttempt = attempt === delays.length - 1;
				const message = error instanceof Error ? error.message : String(error);

				if (isLastAttempt) {
					this.logger.error(
						`Request failed after ${elapsed}ms — giving up [${attemptLabel}]: ${message}`,
					);
					throw error;
				}

				this.logger.warn(
					`Request failed after ${elapsed}ms — retrying in ${delays[attempt]}ms [${attemptLabel}]: ${message}`,
				);
				await sleep(delays[attempt]);
			}
		}

		return [];
	}

	/**
	 * Builds the SODA 3.0 query endpoint URL for a given dataset.
	 */
	buildUrl(datasetId: string): string {
		return `${this.config.apiUrl}/api/v3/views/${datasetId}/query.json`;
	}

	// ── Legacy (kept for dev sampling via SODA_MAX_PAGES) ───────

	/**
	 * Legacy offset-based pagination. Accumulates ALL pages in memory.
	 *
	 * Prefer {@link SodaStreamerService} with cursor-based SoQL queries
	 * for production ingestion. This method exists for dev sampling
	 * and backward compatibility with integration tests.
	 */
	async paginateDataset<TRecord>(
		datasetId: string,
		whereClause?: string,
		orderByField?: string,
		selectColumns?: string[],
	): Promise<TRecord[]> {
		const allRecords: TRecord[] = [];
		const pageSize = this.config.pageSize;
		const maxPages = this.config.maxPages;
		const isSample = maxPages !== null;
		let page = 1;

		const selectPart = selectColumns?.length ? selectColumns.join(", ") : "*";
		const orderPart = orderByField ? `ORDER BY ${orderByField} DESC` : "";
		const wherePart = whereClause ? `WHERE (${whereClause})` : "";
		const query = [selectPart, wherePart, orderPart]
			.filter((s) => s)
			.join(" ")
			.replace("SELECT  ", "SELECT ");

		this.logger.log(
			`Paginating dataset=${datasetId} pageSize=${pageSize}${isSample ? ` maxPages=${maxPages} (dev sample)` : ""}${orderByField ? ` order=${orderByField} DESC` : ""}${whereClause ? ` where="${whereClause}"` : ""}`,
		);

		while (true) {
			if (isSample && page > maxPages!) {
				this.logger.log(
					`Dev sample limit reached (maxPages=${maxPages}) for dataset=${datasetId}: ${allRecords.length} records`,
				);
				break;
			}

			this.logger.debug(`Fetching page ${page} for dataset=${datasetId}`);
			const records = await this.queryDataset<TRecord>(datasetId, {
				query: `SELECT ${query}`,
				pageNumber: page,
				pageSize,
			});
			allRecords.push(...records);

			this.logger.debug(
				`Page ${page} done — got ${records.length} records, total so far: ${allRecords.length}`,
			);

			if (records.length < pageSize) break;

			page++;
		}

		return allRecords;
	}
}
