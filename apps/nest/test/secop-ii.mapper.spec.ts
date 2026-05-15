import { mapSecopII } from '../src/modules/soda-ingestion/mappers/secop-ii.mapper';

describe('mapSecopII', () => {
  it('maps SECOP-II raw record to CreateProcurementNoticeDto', () => {
    const dto = mapSecopII({
      id_del_proceso: 'P-001',
      nombre_del_procedimiento: 'Servicio de nube',
      descripci_n_del_procedimiento: 'Infraestructura cloud',
      entidad: 'Agencia Nacional',
      nit_entidad: '900555111',
      precio_base: '2000000',
      fecha_de_publicacion_del: '2024-04-01',
      fecha_de_recepcion_de: '2024-04-15',
      modalidad_de_contratacion: 'Selección Abreviada',
      tipo_de_contrato: 'Prestación de Servicios',
      codigo_principal_de_categoria: '81112100',
      departamento_entidad: 'Antioquia',
      ciudad_entidad: 'Medellín',
      nit_del_proveedor_adjudicado: '901000111',
      nombre_del_proveedor: 'Cloud SAS',
      valor_total_adjudicacion: '1990000',
      fecha_adjudicacion: '2024-05-01',
      urlproceso: 'https://secop.gov.co/proceso/2',
      fecha_de_ultima_publicaci: '2024-04-10',
      estado_del_procedimiento: 'Convocado',
    });

    expect(dto).toEqual(
      expect.objectContaining({
        secopId: 'P-001',
        source: 'SECOP_II',
        deadlineDate: '2024-04-15',
        department: 'Antioquia',
        processUrl: 'https://secop.gov.co/proceso/2',
      }),
    );
  });
});
