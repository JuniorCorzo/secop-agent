import type { CreateProcurementNoticeDto } from "../../procurement-notices/dto/create-procurement-notice.dto";
import type { ProcurementNoticeStatus } from "../../procurement-notices/procurement-notice.types";
import type { SecopIIRecord } from "../soda-ingestion.types";

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

/**
 * Map SECOP-II `estado_del_procedimiento` to application lifecycle status.
 *
 * SECOP-II (p6dx-8zbt) contains active procurement processes with a real lifecycle:
 * ```
 * Borrador → Publicado/Abierto → Evaluación/En aprobación/Seleccionado → Aprobado/Adjudicado
 *                                                                        → Cancelado/Suspendido
 * ```
 */
const normalizeStatus = (
	rawStatus: string | undefined | null,
): ProcurementNoticeStatus => {
	if (!rawStatus) return "PENDING";
	const upper = rawStatus.toUpperCase().trim();

	// Early stage
	if (upper === "BORRADOR") return "PENDING";

	// Published / open
	if (upper === "PUBLICADO" || upper === "ABIERTO" || upper === "CONVOCADO")
		return "ENRICHING";

	// In evaluation
	if (
		upper === "EVALUACIÓN" ||
		upper === "EVALUACION" ||
		upper === "EN APROBACIÓN" ||
		upper === "EN APROBACION" ||
		upper === "SELECCIONADO"
	)
		return "SCORING";

	// Awarded / approved
	if (upper === "APROBADO" || upper === "ADJUDICADO" || upper === "CELEBRADO")
		return "AWARDED";

	// Cancelled / suspended
	if (upper === "CANCELADO" || upper === "SUSPENDIDO" || upper === "DESCARTADO")
		return "CANCELLED";

	// Fallback: treat unknown non-empty status as a sign of progress → SCORING
	return "SCORING";
};

/**
 * Static mapper for SECOP-II (`p6dx-8zbt`) records.
 * SECOP-II is active procedure data, so deadline is available.
 */
export const mapSecopII = (raw: SecopIIRecord): CreateProcurementNoticeDto => ({
	secopId: raw.id_del_proceso,
	source: "SECOP_II",
	status: normalizeStatus(raw.estado_del_procedimiento),
	title: safeString(raw.nombre_del_procedimiento, 512) ?? raw.id_del_proceso,
	description: raw.descripci_n_del_procedimiento
		? safeString(raw.descripci_n_del_procedimiento, 8192)
		: undefined,
	entityName: safeString(raw.entidad, 512),
	entityNit: safeString(raw.nit_entidad, 32),
	value: toNumber(raw.precio_base),
	currency: "COP",
	publicationDate: raw.fecha_de_publicacion_del,
	deadlineDate: raw.fecha_de_recepcion_de,
	contractingModality: safeString(raw.modalidad_de_contratacion, 256),
	contractType: safeString(raw.tipo_de_contrato, 128),
	unspscCode: safeString(raw.codigo_principal_de_categoria, 32),
	unspscGroup: undefined,
	unspscFamily: undefined,
	unspscClass: undefined,
	unspscName: safeString(raw.nombre_del_procedimiento, 512),
	department: safeString(raw.departamento_entidad, 128),
	location: safeString(raw.ciudad_entidad, 256),
	awardedContractorNit: safeString(raw.nit_del_proveedor_adjudicado, 32),
	awardedContractorName: safeString(raw.nombre_del_proveedor, 512),
	awardedValue: toNumber(raw.valor_total_adjudicacion),
	awardedDate: raw.fecha_adjudicacion,
	processUrl: safeString(
		typeof raw.urlproceso === "object" && raw.urlproceso !== null
			? raw.urlproceso.url
			: raw.urlproceso,
		512,
	),
	sourceLastUpdatedAt: raw.fecha_de_ultima_publicaci,
	sourceMetadata: {
		sourceDataset: "p6dx-8zbt",
		sourceType: "SECOP_II",
		sourceStatus: raw.estado_del_procedimiento ?? null,
	},
});
