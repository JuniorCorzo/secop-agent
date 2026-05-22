/**
 * Bulk CSV import script for SECOP datasets.
 *
 * Usage:
 *   bun run --cwd apps/nest bulk-csv-import --source=SECOP_I --path=./datasets/SECOP_I.csv
 *   bun run --cwd apps/nest bulk-csv-import --source=SECOP_II --path=./datasets/SECOP_II.csv
 *   bun run --cwd apps/nest bulk-csv-import --source=SECOP_I --path=./datasets/SECOP_I.csv --dry-run
 *
 * The script:
 * 1. Reads the CSV file
 * 2. Normalizes headers (Spanish with spaces → snake_case)
 * 3. Maps records using the existing soda-ingestion mappers
 * 4. Batch-upserts to the DB via ProcurementNoticesService.bulkUpsert()
 *
 * Requires: DB connection via environment (same .env as the app).
 */

import { parseArgs } from "util";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { DataSource } from "typeorm";
import { createTypeOrmOptions } from "../src/config/typeorm.options";
import { ConfigService } from "@nestjs/config";
import { mapSecopI } from "../src/modules/soda-ingestion/mappers/secop-i.mapper";
import { mapSecopII } from "../src/modules/soda-ingestion/mappers/secop-ii.mapper";
import type {
	SecopIRecord,
	SecopIIRecord,
} from "../src/modules/soda-ingestion/soda-ingestion.types";
import type { CreateProcurementNoticeDto } from "../src/modules/procurement-notices/dto/create-procurement-notice.dto";

// Load .env manually (scripts run outside NestJS bootstrap)
const envPath = resolve(__dirname, "../.env");
if (existsSync(envPath)) {
	const lines = readFileSync(envPath, "utf-8").split("\n");
	for (const line of lines) {
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
}

const BATCH_SIZE = 500;

interface CsvRow {
	[key: string]: string;
}
interface ImportStats {
	total: number;
	created: number;
	duplicates: number;
	invalid: number;
	errors: string[];
}

/**
 * Normalize CSV header name to snake_case key.
 * Handles Spanish headers with spaces, accents, and mixed case.
 */
function normalizeHeader(header: string): string {
	return header
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // Remove accents
		.replace(/\s+/g, "_") // Spaces to underscores
		.replace(/_+/g, "_") // Multiple underscores to one
		.replace(/^_|_$/g, "") // Trim leading/trailing underscores
		.replace(/[^a-z0-9_]/g, ""); // Remove non-alphanumeric (except underscore)
}

async function parseCsv(
	path: string,
): Promise<{ rows: CsvRow[]; headerMap: Record<string, string> }> {
	const content = readFileSync(path, "utf-8");
	const lines = content.split("\n").filter((line) => line.trim());

	if (lines.length === 0) {
		throw new Error(`Empty CSV file: ${path}`);
	}

	// Parse header (CSV uses comma as delimiter)
	const headers = parseCsvLine(lines[0], ",");

	// Build header normalization map (original → normalized)
	const headerNormalization: Record<string, string> = {};
	const normalizedToIdx: Record<string, number> = {};

	for (let i = 0; i < headers.length; i++) {
		const original = headers[i].trim();
		const normalized = normalizeHeader(original);
		headerNormalization[original] = normalized;

		// Track which index each normalized header maps to (first occurrence)
		if (normalized && !(normalized in normalizedToIdx)) {
			normalizedToIdx[normalized] = i;
		}
	}

	const rows: CsvRow[] = [];
	for (let i = 1; i < lines.length; i++) {
		const values = parseCsvLine(lines[i], ",");
		const row: CsvRow = {};

		for (const [original, normalized] of Object.entries(headerNormalization)) {
			const idx = headers.indexOf(original);
			if (idx !== -1 && normalized) {
				row[normalized] = values[idx]?.trim() ?? "";
			}
		}

		rows.push(row);
	}

	return { rows, headerMap: headerNormalization };
}

function parseCsvLine(line: string, delimiter: string): string[] {
	const result: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === delimiter && !inQuotes) {
			result.push(current);
			current = "";
		} else {
			current += char;
		}
	}
	result.push(current);

	return result;
}

function mapToDto(
	row: CsvRow,
	source: "SECOP_I" | "SECOP_II",
): CreateProcurementNoticeDto {
	if (source === "SECOP_I") {
		const record: SecopIRecord = {
			numero_de_constancia: (row.numero_de_constancia ?? "").slice(0, 64),
			objeto_a_contratar: row.objeto_a_contratar,
			detalle_del_objeto_a_contratar: row.detalle_del_objeto_a_contratar,
			estado_del_proceso: row.estado_del_proceso,
			nombre_entidad: row.nombre_entidad,
			nit_de_la_entidad: row.nit_de_la_entidad,
			cuantia_proceso: row.cuantia_proceso,
			moneda: row.moneda,
			fecha_de_cargue_en_el_secop: row.fecha_de_cargue_en_el_secop,
			modalidad_de_contratacion: row.modalidad_de_contratacion,
			tipo_de_contrato: row.tipo_de_contrato,
			id_clase: row.id_clase,
			nombre_grupo: row.nombre_grupo,
			nombre_familia: row.nombre_familia,
			nombre_clase: row.nombre_clase,
			departamento_entidad: row.departamento_entidad,
			municipio_entidad: row.municipio_entidad,
			identificacion_del_contratista: row.identificacion_del_contratista,
			nom_razon_social_contratista: row.nom_razon_social_contratista,
			cuantia_contrato: row.cuantia_contrato,
			fecha_de_firma_del_contrato: row.fecha_de_firma_del_contrato,
			ruta_proceso_en_secop_i: row.ruta_proceso_en_secop_i,
			ultima_actualizacion: row.ultima_actualizacion,
		};
		return mapSecopI(record);
	} else {
		// CSV actual Spanish headers → Socrata field name aliases
		const descripcion =
			row.descripci_n_del_procedimiento ?? row.descripcion_del_procedimiento;
		const fechaPublicacion =
			row.fecha_de_publicacion_del ?? row.fecha_de_publicacion_del_proceso;
		const fechaRecepcion =
			row.fecha_de_recepcion_de ?? row.fecha_de_recepcion_de_respuestas;
		const proveedor =
			row.nombre_del_proveedor ?? row.nombre_del_proveedor_adjudicado;
		const ultimaPublicacion =
			row.fecha_de_ultima_publicaci ?? row.fecha_de_ultima_publicacion;

		const record: SecopIIRecord = {
			id_del_proceso: (row.id_del_proceso ?? "").slice(0, 64),
			nombre_del_procedimiento: row.nombre_del_procedimiento,
			descripci_n_del_procedimiento: descripcion,
			estado_del_procedimiento: row.estado_del_procedimiento,
			entidad: row.entidad,
			nit_entidad: row.nit_entidad,
			precio_base: row.precio_base,
			fecha_de_publicacion_del: fechaPublicacion,
			fecha_de_recepcion_de: fechaRecepcion,
			modalidad_de_contratacion: row.modalidad_de_contratacion,
			tipo_de_contrato: row.tipo_de_contrato,
			codigo_principal_de_categoria: row.codigo_principal_de_categoria,
			departamento_entidad: row.departamento_entidad,
			ciudad_entidad: row.ciudad_entidad,
			nit_del_proveedor_adjudicado: row.nit_del_proveedor_adjudicado,
			nombre_del_proveedor: proveedor,
			valor_total_adjudicacion: row.valor_total_adjudicacion,
			fecha_adjudicacion: row.fecha_adjudicacion,
			urlproceso: row.urlproceso,
			fecha_de_ultima_publicaci: ultimaPublicacion,
		};
		return mapSecopII(record);
	}
}

/**
 * Convert a string value to a Date, returning null for invalid/unset values.
 * Handles empty strings, "0", "N.A.", and common date formats:
 * - ISO: YYYY-MM-DD, YYYY/MM/DD
 * - Spanish/LATAM: DD/MM/YYYY, DD-MM-YYYY
 * - Timestamps: YYYY-MM-DDTHH:mm:ss, YYYY-MM-DD HH:mm:ss
 */
function safeDate(value: string | undefined | null): Date | null {
	if (!value || value.trim() === "" || value === "0") return null;
	const v = value.trim();

	// Try direct parse first (ISO, timestamps)
	let d = new Date(v);
	if (!isNaN(d.getTime())) return d;

	// Try DD/MM/YYYY or DD-MM-YYYY (Spanish/LATAM format)
	const ddmmyyyy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(v);
	if (ddmmyyyy) {
		const day = parseInt(ddmmyyyy[1], 10);
		const month = parseInt(ddmmyyyy[2], 10);
		const year = parseInt(ddmmyyyy[3], 10);
		if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
			d = new Date(year, month - 1, day);
			if (
				!isNaN(d.getTime()) &&
				d.getFullYear() === year &&
				d.getMonth() === month - 1 &&
				d.getDate() === day
			) {
				return d;
			}
		}
	}

	return null;
}

/**
 * Truncate a string to maxLength, returning null for empty/whitespace-only values.
 */
function safeString(
	value: string | undefined | null,
	maxLength: number,
): string | null {
	if (!value || value.trim() === "") return null;
	return value.length > maxLength ? value.slice(0, maxLength) : value;
}

/** Normalize currency names to ISO 4217 codes. */
function normalizeCurrency(value: string | undefined | null): string | null {
	if (!value || value.trim() === "") return null;
	const upper = value.toUpperCase().trim();
	const map: Record<string, string> = {
		"PESO COLOMBIANO": "COP",
		PESO: "COP",
		COP: "COP",
		DOLAR: "USD",
		DÓLAR: "USD",
		DOLARES: "USD",
		DÓLARES: "USD",
		USD: "USD",
		EURO: "EUR",
		EUR: "EUR",
	};
	return map[upper] ?? safeString(value, 8);
}

async function main() {
	const { values } = parseArgs({
		options: {
			source: { type: "string", short: "s" },
			path: { type: "string", short: "p" },
			"dry-run": { type: "boolean", default: false },
			help: { type: "boolean", short: "h", default: false },
		},
	});

	const source = values.source as "SECOP_I" | "SECOP_II" | undefined;
	const csvPath = values.path as string | undefined;
	const dryRun = values["dry-run"] === true;

	if (values.help || !source || !csvPath) {
		console.log(`
Bulk CSV Import for SECOP datasets

Usage:
  bun run --cwd apps/nest bulk-csv-import --source=SECOP_I --path=./datasets/SECOP_I.csv
  bun run --cwd apps/nest bulk-csv-import --source=SECOP_II --path=./datasets/SECOP_II.csv
  bun run --cwd apps/nest bulk-csv-import --source=SECOP_I --path=./datasets/SECOP_I.csv --dry-run

Options:
  --source    Dataset source: SECOP_I or SECOP_II (required)
  --path      Path to CSV file (required)
  --dry-run   Parse and validate without writing to DB
  --help      Show this help
`);
		process.exit(0);
	}

	if (!["SECOP_I", "SECOP_II"].includes(source)) {
		console.error(`Invalid source: ${source}. Must be SECOP_I or SECOP_II`);
		process.exit(1);
	}

	if (!existsSync(csvPath)) {
		console.error(`CSV file not found: ${csvPath}`);
		process.exit(1);
	}

	console.log(`\n📥 Bulk CSV Import`);
	console.log(`   Source:  ${source}`);
	console.log(`   Path:    ${csvPath}`);
	console.log(`   Dry-run: ${dryRun ? "YES" : "NO"}`);
	console.log("");

	// Parse CSV with header normalization
	console.log("📖 Parsing CSV file...");
	const { rows, headerMap } = await parseCsv(csvPath);
	console.log(`   Found ${rows.length.toLocaleString()} rows`);
	console.log(
		`   Headers normalized: ${Object.keys(headerMap).length} columns`,
	);

	// Show sample of normalized headers (first 10)
	const sampleHeaders = Object.entries(headerMap).slice(0, 10);
	if (sampleHeaders.length > 0) {
		console.log("   Sample headers:");
		for (const [original, normalized] of sampleHeaders) {
			console.log(`     "${original}" → ${normalized}`);
		}
	}

	// Map to DTOs
	console.log("\n🔄 Mapping records...");
	const dtos: CreateProcurementNoticeDto[] = [];
	let invalidCount = 0;
	let skippedCount = 0;

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		try {
			const dto = mapToDto(row, source);

			// Check if the record has the minimum required fields
			if (!dto.secopId || dto.secopId.trim() === "") {
				skippedCount++;
				continue;
			}

			if (!dto.title) {
				// Title is optional in DTO but let's track it
			}

			dtos.push(dto);
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			if (i + 1 <= 5) {
				console.log(`   ⚠️ Row ${i + 1} failed: ${msg}`);
			}
			invalidCount++;
		}

		if ((i + 1) % 100000 === 0) {
			console.log(`   Processed ${(i + 1).toLocaleString()} rows...`);
		}
	}

	console.log(
		`   Mapped ${dtos.length.toLocaleString()} records (${invalidCount} errors, ${skippedCount} skipped)`,
	);

	if (dtos.length === 0) {
		console.error(
			"\n❌ No valid records to import. Check CSV format and headers.",
		);
		process.exit(1);
	}

	if (dryRun) {
		console.log("\n✅ Dry-run complete. No records written to DB.");
		console.log(`   Valid records: ${dtos.length.toLocaleString()}`);
		return;
	}

	// Connect to DB and upsert
	console.log("\n🔌 Connecting to database...");
	const configService = new ConfigService();
	const dataSource = new DataSource(createTypeOrmOptions(configService));
	await dataSource.initialize();
	console.log("   Connected");

	const repository = dataSource.getRepository("ProcurementNotice");

	const stats: ImportStats = {
		total: dtos.length,
		created: 0,
		duplicates: 0,
		invalid: invalidCount + skippedCount,
		errors: [],
	};
	// Process in batches
	const totalBatches = Math.ceil(dtos.length / BATCH_SIZE);

	console.log(`\n📦 Processing ${totalBatches} batches of ${BATCH_SIZE}...`);

	for (let i = 0; i < dtos.length; i += BATCH_SIZE) {
		const batch = dtos.slice(i, i + BATCH_SIZE);
		const batchNum = Math.floor(i / BATCH_SIZE) + 1;

		// Deduplicate within batch
		const batchMap = new Map<string, CreateProcurementNoticeDto>();
		for (const dto of batch) {
			batchMap.set(dto.secopId, dto);
		}
		const batchDtos = Array.from(batchMap.values());

		// Get existing secopIds
		const secopIds = batchDtos.map((d) => d.secopId);
		const existing = await repository.find({
			where: secopIds.map((id) => ({ secopId: id })),
			select: ["secopId"],
		});
		const existingSet = new Set(existing.map((e) => e.secopId));

		// Prepare entities
		const entities = batchDtos.map((dto) => ({
			secopId: dto.secopId,
			source: dto.source ?? source,
			title: safeString(dto.title, 512),
			description: safeString(dto.description, 8192),
			status: dto.status ?? "PENDING",
			entityName: safeString(dto.entityName, 512),
			entityNit: safeString(dto.entityNit, 32),
			value: dto.value ?? null,
			currency: normalizeCurrency(dto.currency) ?? "COP",
			publicationDate: safeDate(dto.publicationDate),
			deadlineDate: safeDate(dto.deadlineDate),
			contractingModality: safeString(dto.contractingModality, 256),
			contractType: safeString(dto.contractType, 128),
			unspscCode: safeString(dto.unspscCode, 32),
			unspscGroup: safeString(dto.unspscGroup, 128),
			unspscFamily: safeString(dto.unspscFamily, 128),
			unspscClass: safeString(dto.unspscClass, 128),
			unspscName: safeString(dto.unspscName, 512),
			department: safeString(dto.department, 128),
			location: safeString(dto.location, 256),
			awardedContractorNit: safeString(dto.awardedContractorNit, 32),
			awardedContractorName: safeString(dto.awardedContractorName, 512),
			awardedValue: dto.awardedValue ?? null,
			awardedDate: safeDate(dto.awardedDate),
			processUrl: safeString(dto.processUrl, 512),
			sourceLastUpdatedAt: safeDate(dto.sourceLastUpdatedAt),
			sourceMetadata: dto.sourceMetadata ?? null,
		}));

		try {
			await repository.upsert(entities as any, ["secopId"]);

			for (const dto of batchDtos) {
				if (existingSet.has(dto.secopId)) {
					stats.duplicates++;
				} else {
					stats.created++;
				}
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			stats.errors.push(`Batch ${batchNum}: ${message}`);
			stats.duplicates += batchDtos.length;
		}

		process.stdout.write(
			`\r   Batch ${batchNum}/${totalBatches} (${Math.round((batchNum / totalBatches) * 100)}%)`,
		);
	}

	await dataSource.destroy();

	// Summary
	const updated = stats.total - stats.created - stats.duplicates;
	console.log("\n\n");
	console.log("═══════════════════════════════════════");
	console.log("              IMPORT SUMMARY");
	console.log("═══════════════════════════════════════");
	console.log(`  Total rows:     ${stats.total.toLocaleString()}`);
	console.log(`  Created:        ${stats.created.toLocaleString()}`);
	console.log(`  Updated:        ${updated.toLocaleString()}`);
	console.log(`  Duplicates:     ${stats.duplicates.toLocaleString()}`);
	console.log(`  Errors/Skipped: ${stats.invalid.toLocaleString()}`);
	if (stats.errors.length > 0) {
		console.log(`\n  DB Errors:      ${stats.errors.length}`);
		for (const err of stats.errors.slice(0, 5)) {
			console.log(`    - ${err}`);
		}
	}
	console.log("═══════════════════════════════════════");
	console.log("");
}

main().catch((error) => {
	console.error("Fatal error:", error);
	process.exit(1);
});
