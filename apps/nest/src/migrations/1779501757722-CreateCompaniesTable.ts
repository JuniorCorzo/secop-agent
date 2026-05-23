import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCompaniesTable1779501757722 implements MigrationInterface {
    name = 'CreateCompaniesTable1779501757722'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "companies" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "nit" character varying(50) NOT NULL, "name" character varying(255) NOT NULL, "sectors" text array NOT NULL DEFAULT '{}', "regions" text array NOT NULL DEFAULT '{}', "liquidity" numeric(10,2) NOT NULL DEFAULT '0', "indebtedness" numeric(10,2) NOT NULL DEFAULT '0', "interest_coverage" numeric(10,2) NOT NULL DEFAULT '0', "contracting_capacity" numeric(18,2) NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_ed61d4dcafb6fe0f595f5e0cbd0" UNIQUE ("nit"), CONSTRAINT "PK_d4bc3e82a314fa9e29f652c2c22" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_companies_nit" ON "companies" ("nit") `);
        await queryRunner.query(`ALTER TABLE "ingestion_jobs" ALTER COLUMN "errors" SET DEFAULT '[]'::jsonb`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ingestion_jobs" ALTER COLUMN "errors" SET DEFAULT '[]'`);
        await queryRunner.query(`DROP INDEX "public"."UQ_companies_nit"`);
        await queryRunner.query(`DROP TABLE "companies"`);
    }

}
