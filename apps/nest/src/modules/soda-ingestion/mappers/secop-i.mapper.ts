import { CreateProcurementNoticeDto } from '../../procurement-notices/dto/create-procurement-notice.dto';
import { SecopIRecord } from '../soda-ingestion.types';

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

/**
 * Static mapper for SECOP-I (`f789-7hwg`) records.
 * SECOP-I is historical/adjudicated contract data, so deadline is absent.
 */
export const mapSecopI = (raw: SecopIRecord): CreateProcurementNoticeDto => ({
  secopId: raw.numero_de_constancia,
  source: 'SECOP_I',
  title: raw.objeto_a_contratar ?? raw.numero_de_constancia,
  description: raw.detalle_del_objeto_a_contratar,
  entityName: raw.nombre_entidad,
  entityNit: raw.nit_de_la_entidad,
  value: toNumber(raw.cuantia_proceso),
  currency: raw.moneda ?? 'COP',
  publicationDate: raw.fecha_de_cargue_en_el_secop,
  deadlineDate: undefined,
  contractingModality: raw.modalidad_de_contratacion,
  contractType: raw.tipo_de_contrato,
  unspscCode: raw.id_clase,
  unspscGroup: raw.nombre_grupo,
  unspscFamily: raw.nombre_familia,
  unspscClass: raw.nombre_clase,
  unspscName: raw.objeto_a_contratar,
  department: raw.departamento_entidad,
  location: raw.municipio_entidad,
  awardedContractorNit: raw.identificacion_del_contratista,
  awardedContractorName: raw.nom_razon_social_contratista,
  awardedValue: toNumber(raw.cuantia_contrato),
  awardedDate: raw.fecha_de_firma_del_contrato,
  processUrl: raw.ruta_proceso_en_secop_i,
  sourceLastUpdatedAt: raw.ultima_actualizacion,
  sourceMetadata: {
    sourceDataset: 'f789-7hwg',
    sourceType: 'SECOP_I',
    sourceStatus: raw.estado_del_proceso ?? null,
  },
});
