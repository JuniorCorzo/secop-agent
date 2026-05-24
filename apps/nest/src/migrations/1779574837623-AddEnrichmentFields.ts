import { MigrationInterface, QueryRunner } from "typeorm";

export class AddEnrichmentFields1779574837623 implements MigrationInterface {
    name = 'AddEnrichmentFields1779574837623'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "latitude" numeric(10,6)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "longitude" numeric(10,6)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "execution_duration_days" integer`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "value_per_day" numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "ingestion_jobs" ALTER COLUMN "errors" SET DEFAULT '[]'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ingestion_jobs" ALTER COLUMN "errors" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "value_per_day"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "execution_duration_days"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "longitude"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "latitude"`);
    }

}
