import { mapSecopI } from '../src/modules/soda-ingestion/mappers/secop-i.mapper';

describe('mapSecopI', () => {
  it('maps SECOP-I raw record to CreateProcurementNoticeDto', () => {
    const dto = mapSecopI({
      numero_de_constancia: 'C-001',
      objeto_a_contratar: 'Suministro de software',
      detalle_del_objeto_a_contratar: 'Licencias y soporte',
      nombre_entidad: 'Ministerio TIC',
      nit_de_la_entidad: '900999999',
      cuantia_proceso: '1500000',
      moneda: 'COP',
      fecha_de_cargue_en_el_secop: '2024-01-01',
      modalidad_de_contratacion: 'Licitación Pública',
      tipo_de_contrato: 'Suministro',
      id_clase: '81111500',
      nombre_grupo: 'Servicios informáticos',
      nombre_familia: 'Software',
      nombre_clase: 'Licencias',
      departamento_entidad: 'Cundinamarca',
      municipio_entidad: 'Bogotá',
      identificacion_del_contratista: '800111222',
      nom_razon_social_contratista: 'Proveedor SAS',
      cuantia_contrato: '1400000',
      fecha_de_firma_del_contrato: '2024-02-01',
      ruta_proceso_en_secop_i: 'https://secop.gov.co/proceso/1',
      ultima_actualizacion: '2024-03-01',
      estado_del_proceso: 'Celebrado',
    });

    expect(dto).toEqual(
      expect.objectContaining({
        secopId: 'C-001',
        source: 'SECOP_I',
        title: 'Suministro de software',
        entityNit: '900999999',
        value: 1500000,
        unspscCode: '81111500',
        awardedContractorName: 'Proveedor SAS',
      }),
    );
  });
});
