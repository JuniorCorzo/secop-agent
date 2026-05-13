import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProcurementNoticesTable1747120000000 implements MigrationInterface {
  name = 'ProcurementNoticesTable1747120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS procurement_notices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        secop_id varchar(64) NOT NULL,
        title varchar(512) NOT NULL,
        description text,
        status varchar(64),
        entity_name varchar(512),
        contact_info text,
        value decimal(18, 2),
        currency varchar(8),
        publication_date date,
        deadline_date date,
        sector varchar(256),
        location varchar(256),
        source_metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_procurement_notices_secop_id ON procurement_notices (secop_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_procurement_notices_status ON procurement_notices (status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_procurement_notices_publication_date ON procurement_notices (publication_date)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_procurement_notices_deadline_date ON procurement_notices (deadline_date)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_procurement_notices_deadline_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_procurement_notices_publication_date`);
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_procurement_notices_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS UQ_procurement_notices_secop_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS procurement_notices`);
  }
}
