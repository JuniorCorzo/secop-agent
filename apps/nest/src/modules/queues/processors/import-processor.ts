/**
 * Sandboxed BullMQ processor for procurement notice ingestion.
 *
 * Runs in an isolated Bun worker thread (`useWorkerThreads: true`).
 * Has its own TypeORM connection — no NestJS DI available here.
 *
 * Each worker thread initializes TypeORM once (module scope), then
 * processes multiple jobs sequentially through the same connection.
 *
 * Returns {@link IngestionJobResult} so the main-thread Worker
 * can emit domain events (NewProcurementNoticeEvent).
 */

import type { SandboxedJob } from "bullmq";
import { DataSource } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { createTypeOrmOptions } from "../../../config/typeorm.options";
import { ProcurementNotice } from "../../procurement-notices/entities/procurement-notice.entity";
import { SectorKeyword } from "../../procurement-notices/entities/sector-keyword.entity";
import { classify } from "../../procurement-notices/utils/sector-classifier.utils";
import {
	IngestionJob,
	IngestionJobStatus,
} from "../../procurement-notices/entities/ingestion-job.entity";

// ── Types ──────────────────────────────────────────────────────

export interface IngestionJobResult {
	created: number;
	updated: number;
	failed: number;
	errors: Array<{ secopId: string; reason: string }>;
}

export interface IngestionRecord {
	secopId: string;
	source?: string;
	title?: string;
	description?: string | null;
	status?: string | null;
	entityName?: string | null;
	entityNit?: string | null;
	value?: number | null;
	currency?: string | null;
	publicationDate?: string | null;
	deadlineDate?: string | null;
	contractingModality?: string | null;
	contractType?: string | null;
	unspscCode?: string | null;
	unspscGroup?: string | null;
	unspscFamily?: string | null;
	unspscClass?: string | null;
	unspscName?: string | null;
	department?: string | null;
	location?: string | null;
	awardedContractorNit?: string | null;
	awardedContractorName?: string | null;
	awardedValue?: number | null;
	awardedDate?: string | null;
	processUrl?: string | null;
	sourceLastUpdatedAt?: string | null;
	sourceMetadata?: Record<string, unknown> | null;
}

interface EntityShape {
	secopId: string;
	source: string;
	title: string;
	description: string | null;
	status: string | null;
	entityName: string | null;
	entityNit: string | null;
	value: number | null;
	currency: string | null;
	publicationDate: Date | null;
	deadlineDate: Date | null;
	contractingModality: string | null;
	contractType: string | null;
	unspscCode: string | null;
	unspscGroup: string | null;
	unspscFamily: string | null;
	unspscClass: string | null;
	unspscName: string | null;
	department: string | null;
	location: string | null;
	awardedContractorNit: string | null;
	awardedContractorName: string | null;
	awardedValue: number | null;
	awardedDate: Date | null;
	processUrl: string | null;
	sourceLastUpdatedAt: Date | null;
	sourceMetadata: Record<string, unknown> | null;
	rawData: Record<string, unknown> | null;
	sector: string | null;
}

// ── Constants ──────────────────────────────────────────────────

const CHUNK_SIZE = 5000;

// ── Lazy TypeORM connection (one per worker thread) ────────────

let _dataSource: DataSource | null = null;

async function getDataSource(): Promise<DataSource> {
	if (!_dataSource || !_dataSource.isInitialized) {
		// In sandboxed context, load .env manually — no NestJS bootstrap here.
		// Bun worker threads share process.env with the main thread, but
		// we add a fallback in case the worker starts before env is populated.
		loadEnvIfNeeded();

		const configService = new ConfigService();
		_dataSource = new DataSource(createTypeOrmOptions(configService));
		await _dataSource.initialize();
	}
	return _dataSource;
}

/**
 * Loads .env file into process.env if DB_HOST is not already set.
 * Uses Bun's native file I/O — no `dotenv` dependency needed.
 */
function loadEnvIfNeeded(): void {
	if (process.env.DB_HOST) return; // Already loaded by parent thread

	try {
		const fs = require("fs");
		const path = require("path");
		// Resolve .env relative to this processor file
		const envPath = path.resolve(__dirname, "../../../../.env");
		if (!fs.existsSync(envPath)) return;

		const content = fs.readFileSync(envPath, "utf-8");
		for (const line of content.split("\n")) {
			const trimmed = line.trim();
			if (!trimmed || trimmed.startsWith("#")) continue;
			const eqIdx = trimmed.indexOf("=");
			if (eqIdx === -1) continue;
			const key = trimmed.slice(0, eqIdx).trim();
			const value = trimmed
				.slice(eqIdx + 1)
				.trim()
				.replace(/^["']|["']$/g, "");
			if (key && !(key in process.env)) {
				process.env[key] = value;
			}
		}
	} catch {
		// .env loading is best-effort. The worker will fail on DB connect
		// if critical vars are missing, which is the correct behavior.
	}
}

// ── Deduplication ──────────────────────────────────────────────

export function deduplicateRecords(
	records: IngestionRecord[],
): IngestionRecord[] {
	const map = new Map<string, IngestionRecord>();
	for (const record of records) {
		map.set(record.secopId, record);
	}
	return Array.from(map.values());
}

// ── Entity mapping ─────────────────────────────────────────────

export function toEntityShape(record: IngestionRecord, sectorKeywords: Pick<SectorKeyword, 'sector' | 'keyword' | 'weight'>[] = []): EntityShape {
	const title = record.title ?? record.secopId;
	const classificationResult = classify(title, sectorKeywords);
	return {
		secopId: record.secopId,
		source: record.source ?? "SECOP_II",
		title,
		description: record.description ?? null,
		status: record.status ?? null,
		entityName: record.entityName ?? null,
		entityNit: record.entityNit ?? null,
		value: record.value ?? null,
		currency: record.currency ?? null,
		publicationDate: record.publicationDate
			? new Date(record.publicationDate)
			: null,
		deadlineDate: record.deadlineDate ? new Date(record.deadlineDate) : null,
		contractingModality: record.contractingModality ?? null,
		contractType: record.contractType ?? null,
		unspscCode: record.unspscCode ?? null,
		unspscGroup: record.unspscGroup ?? null,
		unspscFamily: record.unspscFamily ?? null,
		unspscClass: record.unspscClass ?? null,
		unspscName: record.unspscName ?? null,
		department: record.department ?? null,
		location: record.location ?? null,
		awardedContractorNit: record.awardedContractorNit ?? null,
		awardedContractorName: record.awardedContractorName ?? null,
		awardedValue: record.awardedValue ?? null,
		awardedDate: record.awardedDate ? new Date(record.awardedDate) : null,
		processUrl: record.processUrl ?? null,
		sourceLastUpdatedAt: record.sourceLastUpdatedAt
			? new Date(record.sourceLastUpdatedAt)
			: null,
		sourceMetadata: record.sourceMetadata ?? null,
		rawData: record.sourceMetadata ?? null,
		sector: classificationResult.sector,
	};
}

// ── Processor entry point ──────────────────────────────────────

export default async function importProcessor(
	job: SandboxedJob<{ ingestionJobId: string; records: IngestionRecord[] }>,
): Promise<IngestionJobResult> {
	const { ingestionJobId, records } = job.data;
	const db = await getDataSource();
	const repository = db.getRepository(ProcurementNotice);
	const ingestionJobRepo = db.getRepository(IngestionJob);

	const result: IngestionJobResult = {
		created: 0,
		updated: 0,
		failed: 0,
		errors: [],
	};

	// Mark as processing
	await ingestionJobRepo.update(ingestionJobId, {
		status: IngestionJobStatus.PROCESSING,
	});

	// Deduplicate
	const deduplicated = deduplicateRecords(records);

	// Load all sector keywords once per batch (performance: avoids per-row DB queries)
	const sectorKeywords = await db.getRepository(SectorKeyword).find();

	// Load existing secopIds
	const secopIds = deduplicated.map((r) => r.secopId);
	const existingEntities =
		secopIds.length > 0
			? await repository.find({
					where: secopIds.map((id) => ({ secopId: id })),
					select: ["secopId"],
				})
			: [];
	const existingSet = new Set(existingEntities.map((e) => e.secopId));

	// Process in chunks
	for (let i = 0; i < deduplicated.length; i += CHUNK_SIZE) {
		const chunk = deduplicated.slice(i, i + CHUNK_SIZE);

		try {
			const entities = chunk.map((record) => toEntityShape(record, sectorKeywords));
			await repository.upsert(entities as any, ["secopId"]);

			for (const record of chunk) {
				if (existingSet.has(record.secopId)) {
					result.updated++;
				} else {
					result.created++;
				}
			}
		} catch (error: unknown) {
			const message = error instanceof Error ? error.message : String(error);
			result.failed += chunk.length;
			for (const record of chunk) {
				result.errors.push({ secopId: record.secopId, reason: message });
			}
		}

		await ingestionJobRepo.update(ingestionJobId, {
			createdCount: result.created,
			updatedCount: result.updated,
			failedCount: result.failed,
			errors: result.errors as any,
		});

		// Report progress so BullMQ doesn't think the job is stalled
		const progress =
			deduplicated.length > 0
				? Math.round(((i + chunk.length) / deduplicated.length) * 100)
				: 100;
		await job.updateProgress(progress);
	}

	// Final status
	const finalStatus =
		result.failed === 0
			? IngestionJobStatus.COMPLETED
			: result.created > 0 || result.updated > 0
				? IngestionJobStatus.PARTIAL
				: IngestionJobStatus.FAILED;

	await ingestionJobRepo.update(ingestionJobId, {
		status: finalStatus,
		createdCount: result.created,
		updatedCount: result.updated,
		failedCount: result.failed,
		errors: result.errors as any,
	});

	return result;
}
