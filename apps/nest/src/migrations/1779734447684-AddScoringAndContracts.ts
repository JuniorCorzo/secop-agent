import { MigrationInterface, QueryRunner } from "typeorm";

export class AddScoringAndContracts1779734447684 implements MigrationInterface {
    name = 'AddScoringAndContracts1779734447684'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "company_contracts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "description" text, "unspsc_code" character varying(20) NOT NULL, "value" numeric(18,2) NOT NULL, "client_nit" character varying(50) NOT NULL, "status" character varying(50) NOT NULL, "start_date" TIMESTAMP WITH TIME ZONE, "end_date" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, CONSTRAINT "PK_7a97e49fbf4614bca6f251e36ac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "matching_results" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" character varying(20) NOT NULL, "score" numeric(5,2) NOT NULL DEFAULT '0', "vector_breakdown" jsonb, "justification" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "company_id" uuid NOT NULL, "notice_id" uuid NOT NULL, CONSTRAINT "PK_b07e8c6d91d2c0b18be23abcb5c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_matching_results_notice_id" ON "matching_results" ("notice_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_matching_results_company_id" ON "matching_results" ("company_id") `);
        await queryRunner.query(`ALTER TABLE "companies" ADD "target_ticket" numeric(18,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "companies" ADD "working_capital" numeric(18,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "companies" ADD "annual_revenue" numeric(18,2) NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "companies" ADD "excluded_contract_types" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "companies" ADD "excluded_modalities" text array NOT NULL DEFAULT '{}'`);
        await queryRunner.query(`ALTER TABLE "companies" ADD "unspsc_match_policy" character varying(20) NOT NULL DEFAULT 'strict'`);
        await queryRunner.query(`ALTER TABLE "ingestion_jobs" ALTER COLUMN "errors" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "company_contracts" ADD CONSTRAINT "FK_8a3979e35483c7a31f1cdc97071" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matching_results" ADD CONSTRAINT "FK_c8981287b68288b8f24c3b020c0" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "matching_results" ADD CONSTRAINT "FK_384dd101d072738aef19ac7b019" FOREIGN KEY ("notice_id") REFERENCES "procurement_notices"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "matching_results" DROP CONSTRAINT "FK_384dd101d072738aef19ac7b019"`);
        await queryRunner.query(`ALTER TABLE "matching_results" DROP CONSTRAINT "FK_c8981287b68288b8f24c3b020c0"`);
        await queryRunner.query(`ALTER TABLE "company_contracts" DROP CONSTRAINT "FK_8a3979e35483c7a31f1cdc97071"`);
        await queryRunner.query(`ALTER TABLE "ingestion_jobs" ALTER COLUMN "errors" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "unspsc_match_policy"`);
        await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "excluded_modalities"`);
        await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "excluded_contract_types"`);
        await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "annual_revenue"`);
        await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "working_capital"`);
        await queryRunner.query(`ALTER TABLE "companies" DROP COLUMN "target_ticket"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_matching_results_company_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_matching_results_notice_id"`);
        await queryRunner.query(`DROP TABLE "matching_results"`);
        await queryRunner.query(`DROP TABLE "company_contracts"`);
    }

}
