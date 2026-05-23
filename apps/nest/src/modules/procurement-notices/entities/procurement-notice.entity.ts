import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ProcurementNoticeStatus, ProcurementNoticeSource } from '../procurement-notice.types';

/**
 * Persisted representation of a SECOP procurement notice.
 *
 * Unified schema for both SECOP-I (f789-7hwg) and SECOP-II (p6dx-8zbt) datasets.
 * SECOP-I contains awarded/signed contracts (historical intelligence).
 * SECOP-II contains active procurement processes (opportunity pipeline).
 *
 * Fields absent in a given source are stored as `null`.
 *
 * @see procnotices-spec - Persisted Procurement Notice Record
 */
@Entity({ name: 'procurement_notices' })
@Index('UQ_procurement_notices_secop_id', ['secopId'], { unique: true })
@Index('IDX_procurement_notices_source', ['source'])
@Index('IDX_procurement_notices_unspsc_code', ['unspscCode'])
@Index('IDX_procurement_notices_entity_nit', ['entityNit'])
@Index('IDX_procurement_notices_department', ['department'])
@Index('IDX_procurement_notices_awarded_contractor_nit', ['awardedContractorNit'])
export class ProcurementNotice {
  /** Internal UUID primary key — never exposed as a business identifier. */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Stable SECOP identifier. Unique across all records.
   * SECOP-I: `numero_de_constancia` | SECOP-II: `id_del_proceso`
   */
  @Column({ name: 'secop_id', type: 'varchar', length: 64, nullable: false })
  secopId: string;

  /**
   * Origin dataset. Determines which mapper was used and which fields are available.
   * SECOP-I = awarded contracts (historical). SECOP-II = active processes (pipeline).
   */
  @Column({ name: 'source', type: 'varchar', length: 8, nullable: false })
  source: ProcurementNoticeSource;

  /**
   * Human-readable notice title.
   * SECOP-I: `objeto_a_contratar` | SECOP-II: `nombre_del_procedimiento`
   */
  @Column({ type: 'varchar', length: 512, nullable: false })
  title: string;

  /**
   * Full text description of the procurement object.
   * SECOP-I: `detalle_del_objeto_a_contratar` | SECOP-II: `descripci_n_del_procedimiento`
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Current lifecycle state. Defaults to `PENDING` on creation.
   * Transitions validated by {@link canTransitionProcurementNoticeStatus}.
   */
  @Column({ type: 'varchar', length: 64, nullable: false, default: 'PENDING' })
  status: ProcurementNoticeStatus;

  /**
   * Name of the contracting government entity.
   * SECOP-I: `nombre_entidad` | SECOP-II: `entidad`
   */
  @Column({ name: 'entity_name', type: 'varchar', length: 512, nullable: true })
  entityName: string | null;

  /**
   * NIT (tax ID) of the contracting entity.
   * SECOP-I: `nit_de_la_entidad` | SECOP-II: `nit_entidad`
   * Used for competitive intelligence — tracking which entities buy what.
   */
  @Column({ name: 'entity_nit', type: 'varchar', length: 32, nullable: true })
  entityNit: string | null;

  /**
   * Estimated/base contract value in `currency`.
   * SECOP-I: `cuantia_proceso` | SECOP-II: `precio_base`
   */
  @Column({ type: 'decimal', precision: 18, scale: 2, nullable: true })
  value: number | null;

  /**
   * ISO 4217 currency code.
   * SECOP-I: `moneda` | SECOP-II: always `COP`
   */
  @Column({ type: 'varchar', length: 8, nullable: true })
  currency: string | null;

  /**
   * Date the notice was officially published.
   * SECOP-I: `fecha_de_cargue_en_el_secop` | SECOP-II: `fecha_de_publicacion_del`
   */
  @Column({ name: 'publication_date', type: 'date', nullable: true })
  publicationDate: Date | null;

  /**
   * Submission deadline for proposals.
   * SECOP-I: null (contracts already signed) | SECOP-II: `fecha_de_recepcion_de`
   */
  @Column({ name: 'deadline_date', type: 'date', nullable: true })
  deadlineDate: Date | null;

  /**
   * Contracting modality (e.g., Licitación Pública, Contratación Directa).
   * SECOP-I: `modalidad_de_contratacion` | SECOP-II: `modalidad_de_contratacion`
   * Critical filter — companies target specific modalities.
   */
  @Column({ name: 'contracting_modality', type: 'varchar', length: 256, nullable: true })
  contractingModality: string | null;

  /**
   * Contract type (e.g., Obra, Prestación de Servicios, Suministro).
   * SECOP-I: `tipo_de_contrato` | SECOP-II: `tipo_de_contrato`
   */
  @Column({ name: 'contract_type', type: 'varchar', length: 128, nullable: true })
  contractType: string | null;

  /**
   * UNSPSC classification code for the procurement object.
   * SECOP-I: `id_clase` (level 3) | SECOP-II: `codigo_principal_de_categoria`
   * Core field for semantic scoring — matches company capabilities to opportunities.
   */
  @Column({ name: 'unspsc_code', type: 'varchar', length: 32, nullable: true })
  unspscCode: string | null;

  /**
   * UNSPSC level-1 group name (broadest classification).
   * SECOP-I: `nombre_grupo` | SECOP-II: null
   */
  @Column({ name: 'unspsc_group', type: 'varchar', length: 128, nullable: true })
  unspscGroup: string | null;

  /**
   * UNSPSC level-2 family name.
   * SECOP-I: `nombre_familia` | SECOP-II: null
   */
  @Column({ name: 'unspsc_family', type: 'varchar', length: 128, nullable: true })
  unspscFamily: string | null;

  /**
   * UNSPSC level-3 class name (most specific classification).
   * SECOP-I: `nombre_clase` | SECOP-II: null
   */
  @Column({ name: 'unspsc_class', type: 'varchar', length: 128, nullable: true })
  unspscClass: string | null;

  /**
   * Human-readable UNSPSC object name.
   * SECOP-I: `objeto_a_contratar` | SECOP-II: derived from `codigo_principal_de_categoria`
   */
  @Column({ name: 'unspsc_name', type: 'varchar', length: 512, nullable: true })
  unspscName: string | null;

  /**
   * Geographic department of the contracting entity.
   * SECOP-I: `departamento_entidad` | SECOP-II: `departamento_entidad`
   */
  @Column({ type: 'varchar', length: 128, nullable: true })
  department: string | null;

  /**
   * City/municipality of the contracting entity or execution location.
   * SECOP-I: `municipio_entidad` | SECOP-II: `ciudad_entidad`
   */
  @Column({ type: 'varchar', length: 256, nullable: true })
  location: string | null;

  /**
   * NIT of the awarded contractor.
   * SECOP-I: `identificacion_del_contratista` | SECOP-II: `nit_del_proveedor_adjudicado`
   * Used for competitive intelligence — who won what.
   */
  @Column({ name: 'awarded_contractor_nit', type: 'varchar', length: 32, nullable: true })
  awardedContractorNit: string | null;

  /**
   * Name of the awarded contractor.
   * SECOP-I: `nom_razon_social_contratista` | SECOP-II: `nombre_del_proveedor`
   */
  @Column({ name: 'awarded_contractor_name', type: 'varchar', length: 512, nullable: true })
  awardedContractorName: string | null;

  /**
   * Final awarded contract value.
   * SECOP-I: `cuantia_contrato` | SECOP-II: `valor_total_adjudicacion`
   * Market intelligence — actual vs estimated value.
   */
  @Column({ name: 'awarded_value', type: 'decimal', precision: 18, scale: 2, nullable: true })
  awardedValue: number | null;

  /**
   * Date the contract was awarded/signed.
   * SECOP-I: `fecha_de_firma_del_contrato` | SECOP-II: `fecha_adjudicacion`
   */
  @Column({ name: 'awarded_date', type: 'date', nullable: true })
  awardedDate: Date | null;

  /**
   * Direct URL to the process in the SECOP platform.
   * SECOP-I: `ruta_proceso_en_secop_i` | SECOP-II: `urlproceso`
   */
  @Column({ name: 'process_url', type: 'varchar', length: 512, nullable: true })
  processUrl: string | null;

  /**
   * Last modification timestamp from the source dataset.
   * SECOP-I: `ultima_actualizacion` | SECOP-II: `fecha_de_ultima_publicaci`
   * Used by the ingestion scheduler for incremental fetching.
   */
  @Column({ name: 'source_last_updated_at', type: 'timestamptz', nullable: true })
  sourceLastUpdatedAt: Date | null;

  /** Raw metadata from the SECOP source (JSON). Preserves original API response for enrichment. */
  @Column({ name: 'source_metadata', type: 'jsonb', nullable: true })
  sourceMetadata: Record<string, unknown> | null;

  /** Complete raw ingestion payload for upstream audit fidelity. */
  @Column({ name: 'raw_data', type: 'jsonb', nullable: true })
  rawData: Record<string, unknown> | null;

  /**
   * Classified industry sector, determined by the Keyword Scoring algorithm.
   * Populated during batch ingestion and via the POST /:id/classify endpoint.
   * Null until classification is run; "Otros" when no keywords match.
   *
   * @see sector-classification spec
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  sector: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  /**
   * Soft delete timestamp. When set, excluded from default queries.
   * Use `withDeleted: true` to include soft-deleted records.
   */
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
