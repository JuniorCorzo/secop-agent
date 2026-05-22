import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIngestionState1779392753851 implements MigrationInterface {
    name = 'CreateIngestionState1779392753851'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ingestion_state" ("source" character varying(16) NOT NULL, "last_cursor_value" character varying(64), "consecutive_failures" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d9eab3d6fa40f86ac62e39b0987" PRIMARY KEY ("source"))`);
        await queryRunner.query(`ALTER TABLE "ingestion_jobs" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "ingestion_jobs" ALTER COLUMN "errors" SET DEFAULT '[]'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ingestion_jobs" ALTER COLUMN "errors" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "ingestion_jobs" ALTER COLUMN "status" SET DEFAULT 'ACCEPTED'`);
        await queryRunner.query(`DROP TABLE "ingestion_state"`);
    }

}
