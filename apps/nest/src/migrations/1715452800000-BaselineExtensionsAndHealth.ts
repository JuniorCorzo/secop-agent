import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineExtensionsAndHealth1715452800000 implements MigrationInterface {
  name = 'BaselineExtensionsAndHealth1715452800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS schema_health (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        check_name varchar(64) NOT NULL,
        healthy boolean NOT NULL DEFAULT true,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS schema_health`);
    // Extensions are intentionally left in place; dropping them is destructive
    // and may affect other schemas or future migrations.
  }
}
