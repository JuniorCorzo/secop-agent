import type { CreateProcurementNoticeDto } from "../../procurement-notices/dto/create-procurement-notice.dto";
import type { ProcurementNoticeStatus } from "../../procurement-notices/procurement-notice.types";
import type { SecopIRecord } from "../soda-ingestion.types";

const toNumber = (value: unknown): number | undefined => {
	if (typeof value === "number") return value;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
};

/** Truncate a string to maxLength, returning undefined for empty/whitespace-only values. */
const safeString = (
	value: string | undefined | null,
	maxLength: number,
): string | undefined => {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (trimmed === "") return undefined;
	return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
};

/** Normalize currency names to ISO 4217 codes. Falls back to truncation if unknown. */
const normalizeCurrency = (
	value: string | undefined | null,
): string | undefined => {
	if (!value || value.trim() === "") return undefined;
	const upper = value.toUpperCase().trim();
	const map: Record<string, string> = {
		"PESO COLOMBIANO": "COP",
		PESO: "COP",
		PESOS: "COP",
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
};

/**
 * Map SECOP-I `estado_del_proceso` to application lifecycle status.
 *
 * SECOP-I (f789-7hwg) contains historical contract data (already awarded/signed).
 * Most records represent completed or active contracts, so they default to `AWARDED`.
 * Edge cases: `Descartado` → REJECTED, `Borrador` → PENDING.
 */
const normalizeStatus = (
	rawStatus: string | undefined | null,
): ProcurementNoticeStatus => {
	if (!rawStatus) return "PENDING";
	const upper = rawStatus.toUpperCase().trim();

	// Rejected / cancelled states
	if (upper.startsWith("DESCARTADO")) return "REJECTED";
	if (upper.startsWith("TERMINADO ANORMALMENTE")) return "CANCELLED";

	// Draft — not yet published
	if (upper === "BORRADOR") return "PENDING";

	// All other SECOP I states represent awarded/signed contracts
	// CELEBRADO, LIQUIDADO, CONVOCADO, ADJUDICADO, TERMINADO SIN LIQUIDAR
	return "AWARDED";
};

/**
 * Static mapper for SECOP-I (`f789-7hwg`) records.
 * SECOP-I is historical/adjudicated contract data, so deadline is absent.
 */
export const mapSecopI = (raw: SecopIRecord): CreateProcurementNoticeDto => ({
	secopId: raw.numero_de_constancia,
	source: "SECOP_I",
	status: normalizeStatus(raw.estado_del_proceso),
	title: safeString(raw.objeto_a_contratar, 512) ?? raw.numero_de_constancia,
	description: raw.detalle_del_objeto_a_contratar
		? safeString(raw.detalle_del_objeto_a_contratar, 8192)
		: undefined,
	entityName: safeString(raw.nombre_entidad, 512),
	entityNit: safeString(raw.nit_de_la_entidad, 32),
	value: toNumber(raw.cuantia_proceso),
	currency: normalizeCurrency(raw.moneda) ?? "COP",
	publicationDate: raw.fecha_de_cargue_en_el_secop,
	deadlineDate: undefined,
	contractingModality: safeString(raw.modalidad_de_contratacion, 256),
	contractType: safeString(raw.tipo_de_contrato, 128),
	unspscCode: safeString(raw.id_clase, 32),
	unspscGroup: safeString(raw.nombre_grupo, 128),
	unspscFamily: safeString(raw.nombre_familia, 128),
	unspscClass: safeString(raw.nombre_clase, 128),
	unspscName: safeString(raw.objeto_a_contratar, 512),
	department: safeString(raw.departamento_entidad, 128),
	location: safeString(raw.municipio_entidad, 256),
	awardedContractorNit: safeString(raw.identificacion_del_contratista, 32),
	awardedContractorName: safeString(raw.nom_razon_social_contratista, 512),
	awardedValue: toNumber(raw.cuantia_contrato),
	awardedDate: raw.fecha_de_firma_del_contrato,
	processUrl: safeString(
		typeof raw.ruta_proceso_en_secop_i === "object" &&
			raw.ruta_proceso_en_secop_i !== null
			? raw.ruta_proceso_en_secop_i.url
			: raw.ruta_proceso_en_secop_i,
		512,
	),
	sourceLastUpdatedAt: raw.ultima_actualizacion,
	sourceMetadata: {
		sourceDataset: "f789-7hwg",
		sourceType: "SECOP_I",
		sourceStatus: raw.estado_del_proceso ?? null,
	},
});
