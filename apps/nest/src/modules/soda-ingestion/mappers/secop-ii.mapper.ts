import { CreateProcurementNoticeDto } from '../../procurement-notices/dto/create-procurement-notice.dto';
import { SecopIIRecord } from '../soda-ingestion.types';

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

/**
 * Static mapper for SECOP-II (`p6dx-8zbt`) records.
 * SECOP-II is active procedure data, so deadline is available.
 */
export const mapSecopII = (raw: SecopIIRecord): CreateProcurementNoticeDto => ({
  secopId: raw.id_del_proceso,
  source: 'SECOP_II',
  title: raw.nombre_del_procedimiento ?? raw.id_del_proceso,
  description: raw.descripci_n_del_procedimiento,
  entityName: raw.entidad,
  entityNit: raw.nit_entidad,
  value: toNumber(raw.precio_base),
  currency: 'COP',
  publicationDate: raw.fecha_de_publicacion_del,
  deadlineDate: raw.fecha_de_recepcion_de,
  contractingModality: raw.modalidad_de_contratacion,
  contractType: raw.tipo_de_contrato,
  unspscCode: raw.codigo_principal_de_categoria,
  unspscGroup: undefined,
  unspscFamily: undefined,
  unspscClass: undefined,
  unspscName: raw.nombre_del_procedimiento,
  department: raw.departamento_entidad,
  location: raw.ciudad_entidad,
  awardedContractorNit: raw.nit_del_proveedor_adjudicado,
  awardedContractorName: raw.nombre_del_proveedor,
  awardedValue: toNumber(raw.valor_total_adjudicacion),
  awardedDate: raw.fecha_adjudicacion,
  processUrl: raw.urlproceso,
  sourceLastUpdatedAt: raw.fecha_de_ultima_publicaci,
  sourceMetadata: {
    sourceDataset: 'p6dx-8zbt',
    sourceType: 'SECOP_II',
    sourceStatus: raw.estado_del_procedimiento ?? null,
  },
});
