import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSectorClassification1779792715000 implements MigrationInterface {
    name = 'AddSectorClassification1779792715000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Create sector_keywords table
        await queryRunner.query(`
            CREATE TABLE "sector_keywords" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "sector" character varying(50) NOT NULL,
                "keyword" character varying(100) NOT NULL,
                "weight" numeric(3,2) NOT NULL,
                CONSTRAINT "UQ_sector_keywords_sector_keyword" UNIQUE ("sector", "keyword"),
                CONSTRAINT "PK_sector_keywords" PRIMARY KEY ("id")
            )
        `);

        // Add sector column to procurement_notices
        await queryRunner.query(`
            ALTER TABLE "procurement_notices"
            ADD COLUMN "sector" character varying(50) NULL
        `);

        // Seed: SALUD
        await queryRunner.query(`
            INSERT INTO "sector_keywords" ("sector", "keyword", "weight") VALUES
            ('SALUD', 'medicamento', 1.00),
            ('SALUD', 'quirurgico', 0.90),
            ('SALUD', 'hospital', 0.80),
            ('SALUD', 'clinica', 0.80),
            ('SALUD', 'farmaceutico', 0.90),
            ('SALUD', 'vacuna', 1.00),
            ('SALUD', 'medico', 0.70),
            ('SALUD', 'salud', 0.60),
            ('SALUD', 'enfermeria', 0.80),
            ('SALUD', 'ambulancia', 0.90)
        `);

        // Seed: TI
        await queryRunner.query(`
            INSERT INTO "sector_keywords" ("sector", "keyword", "weight") VALUES
            ('TI', 'software', 1.00),
            ('TI', 'hardware', 0.90),
            ('TI', 'informatica', 0.80),
            ('TI', 'licencia', 0.70),
            ('TI', 'tecnologia', 0.60),
            ('TI', 'sistema', 0.50),
            ('TI', 'plataforma', 0.60),
            ('TI', 'ciberseguridad', 1.00),
            ('TI', 'nube', 0.80),
            ('TI', 'base de datos', 0.90)
        `);

        // Seed: INFRAESTRUCTURA
        await queryRunner.query(`
            INSERT INTO "sector_keywords" ("sector", "keyword", "weight") VALUES
            ('INFRAESTRUCTURA', 'construccion', 1.00),
            ('INFRAESTRUCTURA', 'obra civil', 1.00),
            ('INFRAESTRUCTURA', 'pavimento', 0.90),
            ('INFRAESTRUCTURA', 'vial', 0.80),
            ('INFRAESTRUCTURA', 'puente', 0.90),
            ('INFRAESTRUCTURA', 'acueducto', 0.90),
            ('INFRAESTRUCTURA', 'alcantarillado', 0.90),
            ('INFRAESTRUCTURA', 'edificacion', 0.80),
            ('INFRAESTRUCTURA', 'mantenimiento vial', 1.00),
            ('INFRAESTRUCTURA', 'estructuras', 0.70)
        `);

        // Seed: EDUCACION
        await queryRunner.query(`
            INSERT INTO "sector_keywords" ("sector", "keyword", "weight") VALUES
            ('EDUCACION', 'educacion', 1.00),
            ('EDUCACION', 'capacitacion', 0.80),
            ('EDUCACION', 'formacion', 0.70),
            ('EDUCACION', 'colegio', 0.90),
            ('EDUCACION', 'universidad', 0.90),
            ('EDUCACION', 'escuela', 0.80),
            ('EDUCACION', 'pedagogia', 1.00),
            ('EDUCACION', 'docente', 0.90),
            ('EDUCACION', 'material educativo', 1.00),
            ('EDUCACION', 'bienestar estudiantil', 0.90)
        `);

        // Seed: ALIMENTOS
        await queryRunner.query(`
            INSERT INTO "sector_keywords" ("sector", "keyword", "weight") VALUES
            ('ALIMENTOS', 'alimento', 1.00),
            ('ALIMENTOS', 'suministro alimentario', 1.00),
            ('ALIMENTOS', 'comida', 0.80),
            ('ALIMENTOS', 'nutricion', 0.90),
            ('ALIMENTOS', 'refrigerio', 0.90),
            ('ALIMENTOS', 'mercado', 0.60),
            ('ALIMENTOS', 'cocina', 0.60),
            ('ALIMENTOS', 'racion', 0.80),
            ('ALIMENTOS', 'catering', 0.90),
            ('ALIMENTOS', 'bovino', 0.70)
        `);

        // Seed: TRANSPORTE
        await queryRunner.query(`
            INSERT INTO "sector_keywords" ("sector", "keyword", "weight") VALUES
            ('TRANSPORTE', 'transporte', 1.00),
            ('TRANSPORTE', 'vehiculo', 0.80),
            ('TRANSPORTE', 'flota', 0.90),
            ('TRANSPORTE', 'logistica', 0.80),
            ('TRANSPORTE', 'flete', 0.90),
            ('TRANSPORTE', 'bus', 0.70),
            ('TRANSPORTE', 'combustible', 0.70),
            ('TRANSPORTE', 'movilidad', 0.70),
            ('TRANSPORTE', 'traslado', 0.80),
            ('TRANSPORTE', 'automotor', 0.80)
        `);

        // Seed: SERVICIOS
        await queryRunner.query(`
            INSERT INTO "sector_keywords" ("sector", "keyword", "weight") VALUES
            ('SERVICIOS', 'aseo', 0.90),
            ('SERVICIOS', 'vigilancia', 0.90),
            ('SERVICIOS', 'mantenimiento', 0.70),
            ('SERVICIOS', 'consultoria', 0.80),
            ('SERVICIOS', 'asesoria', 0.80),
            ('SERVICIOS', 'limpieza', 0.90),
            ('SERVICIOS', 'jardineria', 0.90),
            ('SERVICIOS', 'cafeteria', 0.80),
            ('SERVICIOS', 'soporte', 0.60),
            ('SERVICIOS', 'seguridad privada', 1.00)
        `);

        // Seed: FINANCIERO
        await queryRunner.query(`
            INSERT INTO "sector_keywords" ("sector", "keyword", "weight") VALUES
            ('FINANCIERO', 'credito', 0.90),
            ('FINANCIERO', 'prestamo', 0.90),
            ('FINANCIERO', 'seguro', 0.80),
            ('FINANCIERO', 'auditoria', 0.80),
            ('FINANCIERO', 'contabilidad', 0.80),
            ('FINANCIERO', 'presupuesto', 0.70),
            ('FINANCIERO', 'financiero', 1.00),
            ('FINANCIERO', 'banca', 1.00),
            ('FINANCIERO', 'impuesto', 0.80),
            ('FINANCIERO', 'tributario', 0.90)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Remove seeds
        await queryRunner.query(`DELETE FROM "sector_keywords"`);

        // Remove sector column from procurement_notices
        await queryRunner.query(`
            ALTER TABLE "procurement_notices"
            DROP COLUMN "sector"
        `);

        // Drop sector_keywords table
        await queryRunner.query(`DROP TABLE "sector_keywords"`);
    }
}
