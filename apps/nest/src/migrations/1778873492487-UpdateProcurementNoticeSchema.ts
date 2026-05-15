import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateProcurementNoticeSchema1778873492487 implements MigrationInterface {
    name = 'UpdateProcurementNoticeSchema1778873492487'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
        await queryRunner.query(`DROP INDEX "public"."uq_procurement_notices_secop_id"`);
        await queryRunner.query(`DROP INDEX "public"."idx_procurement_notices_status"`);
        await queryRunner.query(`DROP INDEX "public"."idx_procurement_notices_publication_date"`);
        await queryRunner.query(`DROP INDEX "public"."idx_procurement_notices_deadline_date"`);
        // ingestion_jobs may already exist from a prior migration — skip if so
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "ingestion_jobs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" character varying(64) NOT NULL, "secop_id" character varying(64), "created_count" integer NOT NULL DEFAULT '0', "updated_count" integer NOT NULL DEFAULT '0', "failed_count" integer NOT NULL DEFAULT '0', "errors" jsonb NOT NULL DEFAULT '[]'::jsonb, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_78a3cba789582043cfc8ba82edd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "schema_health" DROP COLUMN "check_name"`);
        await queryRunner.query(`ALTER TABLE "schema_health" DROP COLUMN "created_at"`);
        await queryRunner.query(`ALTER TABLE "schema_health" DROP COLUMN "updated_at"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "contact_info"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "sector"`);
        await queryRunner.query(`ALTER TABLE "schema_health" ADD "checkName" character varying(64) NOT NULL`);
        await queryRunner.query(`ALTER TABLE "schema_health" ADD "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "schema_health" ADD "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        // Add source with a temporary default to handle existing rows, then drop the default
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "source" character varying(8) NOT NULL DEFAULT 'SECOP_II'`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ALTER COLUMN "source" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "entity_nit" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "contracting_modality" character varying(256)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "contract_type" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "unspsc_code" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "unspsc_group" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "unspsc_family" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "unspsc_class" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "unspsc_name" character varying(512)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "department" character varying(128)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "awarded_contractor_nit" character varying(32)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "awarded_contractor_name" character varying(512)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "awarded_value" numeric(18,2)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "awarded_date" date`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "process_url" character varying(512)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "source_last_updated_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD IF NOT EXISTS "raw_data" jsonb`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email")`);
        await queryRunner.query(`ALTER TYPE "public"."user_role_enum" RENAME TO "user_role_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('admin', 'analista', 'viewer')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."users_role_enum" USING "role"::"text"::"public"."users_role_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'viewer'`);
        await queryRunner.query(`DROP TYPE "public"."user_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ALTER COLUMN "status" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ALTER COLUMN "status" SET DEFAULT 'PENDING'`);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_procurement_notices_awarded_contractor_nit" ON "procurement_notices" ("awarded_contractor_nit") `);
        await queryRunner.query(`CREATE INDEX "IDX_procurement_notices_department" ON "procurement_notices" ("department") `);
        await queryRunner.query(`CREATE INDEX "IDX_procurement_notices_entity_nit" ON "procurement_notices" ("entity_nit") `);
        await queryRunner.query(`CREATE INDEX "IDX_procurement_notices_unspsc_code" ON "procurement_notices" ("unspsc_code") `);
        await queryRunner.query(`CREATE INDEX "IDX_procurement_notices_source" ON "procurement_notices" ("source") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_procurement_notices_secop_id" ON "procurement_notices" ("secop_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_procurement_notices_secop_id"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_procurement_notices_source"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_procurement_notices_unspsc_code"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_procurement_notices_entity_nit"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_procurement_notices_department"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_procurement_notices_awarded_contractor_nit"`);
        await queryRunner.query(`DROP INDEX "public"."UQ_users_email"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ALTER COLUMN "status" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ALTER COLUMN "status" DROP NOT NULL`);
        await queryRunner.query(`CREATE TYPE "public"."user_role_enum_old" AS ENUM('admin', 'analista', 'viewer')`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."user_role_enum_old" USING "role"::"text"::"public"."user_role_enum_old"`);
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'viewer'`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."user_role_enum_old" RENAME TO "user_role_enum"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "deleted_at"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "raw_data"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "source_last_updated_at"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "process_url"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "awarded_date"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "awarded_value"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "awarded_contractor_name"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "awarded_contractor_nit"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "department"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "unspsc_name"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "unspsc_class"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "unspsc_family"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "unspsc_group"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "unspsc_code"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "contract_type"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "contracting_modality"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "entity_nit"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" DROP COLUMN "source"`);
        await queryRunner.query(`ALTER TABLE "schema_health" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "schema_health" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "schema_health" DROP COLUMN "checkName"`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "sector" character varying(256)`);
        await queryRunner.query(`ALTER TABLE "procurement_notices" ADD "contact_info" text`);
        await queryRunner.query(`ALTER TABLE "schema_health" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "schema_health" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "schema_health" ADD "check_name" character varying(64) NOT NULL`);
        await queryRunner.query(`DROP TABLE "ingestion_jobs"`);
        await queryRunner.query(`CREATE INDEX "idx_procurement_notices_deadline_date" ON "procurement_notices" ("deadline_date") `);
        await queryRunner.query(`CREATE INDEX "idx_procurement_notices_publication_date" ON "procurement_notices" ("publication_date") `);
        await queryRunner.query(`CREATE INDEX "idx_procurement_notices_status" ON "procurement_notices" ("status") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_procurement_notices_secop_id" ON "procurement_notices" ("secop_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") `);
    }

}
