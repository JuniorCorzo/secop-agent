export interface SecopIRecord {
  numero_de_constancia: string;
  objeto_a_contratar?: string;
  detalle_del_objeto_a_contratar?: string;
  estado_del_proceso?: string;
  nombre_entidad?: string;
  nit_de_la_entidad?: string;
  cuantia_proceso?: number | string;
  moneda?: string;
  fecha_de_cargue_en_el_secop?: string;
  modalidad_de_contratacion?: string;
  tipo_de_contrato?: string;
  id_clase?: string;
  nombre_grupo?: string;
  nombre_familia?: string;
  nombre_clase?: string;
  departamento_entidad?: string;
  municipio_entidad?: string;
  identificacion_del_contratista?: string;
  nom_razon_social_contratista?: string;
  cuantia_contrato?: number | string;
  fecha_de_firma_del_contrato?: string;
  ruta_proceso_en_secop_i?: string;
  ultima_actualizacion?: string;
  [key: string]: unknown;
}

export interface SecopIIRecord {
  id_del_proceso: string;
  nombre_del_procedimiento?: string;
  descripci_n_del_procedimiento?: string;
  estado_del_procedimiento?: string;
  entidad?: string;
  nit_entidad?: string;
  precio_base?: number | string;
  fecha_de_publicacion_del?: string;
  fecha_de_recepcion_de?: string;
  modalidad_de_contratacion?: string;
  tipo_de_contrato?: string;
  codigo_principal_de_categoria?: string;
  departamento_entidad?: string;
  ciudad_entidad?: string;
  nit_del_proveedor_adjudicado?: string;
  nombre_del_proveedor?: string;
  valor_total_adjudicacion?: number | string;
  fecha_adjudicacion?: string;
  urlproceso?: string;
  fecha_de_ultima_publicaci?: string;
  [key: string]: unknown;
}

export interface SodaPageResponse<TRecord> {
  results?: TRecord[];
  data?: TRecord[];
}

export interface DatasetFailureState {
  consecutiveFailures: number;
  lastRunTimestamp: string | null;
}
