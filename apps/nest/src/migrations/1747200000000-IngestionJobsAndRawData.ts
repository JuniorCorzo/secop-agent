import { MigrationInterface, QueryRunner } from 'typeorm';

export class IngestionJobsAndRawData1747200000000 implements MigrationInterface {
  name = 'IngestionJobsAndRawData1747200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ingestion_jobs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        status varchar(64) NOT NULL DEFAULT 'ACCEPTED',
        secop_id varchar(64),
        created_count integer NOT NULL DEFAULT 0,
        updated_count integer NOT NULL DEFAULT 0,
        failed_count integer NOT NULL DEFAULT 0,
        errors jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE procurement_notices
      ADD COLUMN IF NOT EXISTS raw_data jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE procurement_notices
      DROP COLUMN IF EXISTS raw_data
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS ingestion_jobs`);
  }
}
