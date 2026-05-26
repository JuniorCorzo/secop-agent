import { MigrationInterface, QueryRunner } from "typeorm";

export class AddScoreLogsTable1779742574361 implements MigrationInterface {
    name = 'AddScoreLogsTable1779742574361'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "score_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "total_score" numeric(5,2) NOT NULL DEFAULT '0', "category" character varying(20) NOT NULL, "breakdown" jsonb, "explanation" text, "rag_evidence" jsonb, "filter_result" jsonb, "model_version" character varying(50), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "notice_id" uuid NOT NULL, CONSTRAINT "PK_c117ae452b140aa3d7d06c9523c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_score_logs_notice_id" ON "score_logs" ("notice_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_score_logs_company_id" ON "score_logs" ("company_id") `);
        await queryRunner.query(`ALTER TABLE "ingestion_jobs" ALTER COLUMN "errors" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "score_logs" ADD CONSTRAINT "FK_46ad8eade19c85327a6fdef1e1e" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "score_logs" ADD CONSTRAINT "FK_9c53f50b6574cec8b2c24f69689" FOREIGN KEY ("notice_id") REFERENCES "procurement_notices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "score_logs" DROP CONSTRAINT "FK_9c53f50b6574cec8b2c24f69689"`);
        await queryRunner.query(`ALTER TABLE "score_logs" DROP CONSTRAINT "FK_46ad8eade19c85327a6fdef1e1e"`);
        await queryRunner.query(`ALTER TABLE "ingestion_jobs" ALTER COLUMN "errors" SET DEFAULT '[]'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_score_logs_company_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_score_logs_notice_id"`);
        await queryRunner.query(`DROP TABLE "score_logs"`);
    }

}
