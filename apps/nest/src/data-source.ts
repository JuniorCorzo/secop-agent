import { DataSource, type DataSourceOptions } from "typeorm";
import { databaseConfig } from "./config/database.config";
import { SchemaHealth } from "./common/entities/schema-health.entity";
import { User } from "./modules/auth/entities/user.entity";
import { IngestionJob } from "./modules/procurement-notices/entities/ingestion-job.entity";
import { ProcurementNotice } from "./modules/procurement-notices/entities/procurement-notice.entity";
import { SectorKeyword } from "./modules/procurement-notices/entities/sector-keyword.entity";
import { IngestionState } from "./modules/soda-ingestion/entities/ingestion-state.entity";
import { Company } from "./modules/companies/entities/company.entity";
import { CompanyContract } from "./modules/companies/entities/company-contract.entity";
import { MatchingResult } from "./modules/scoring/entities/matching-result.entity";
import { ScoreLog } from "./modules/scoring/entities/score-log.entity";

/**
 * TypeORM CLI data source — used only for migration:generate and migration:run.
 * Reads DB config directly from process.env without full NestJS env validation
 * so the CLI works with a minimal .env containing only DB_* variables.
 */
/**
 * Converts a value to its boolean equivalent.
 *
 * @param value - The input value to check.
 * @returns True if the value is explicitly true or the string "true", otherwise false.
 */
const toBoolean = (value: unknown): boolean =>
	value === true || value === "true";

const db = databaseConfig({
	DB_HOST: process.env.DB_HOST ?? "localhost",
	DB_PORT: Number(process.env.DB_PORT ?? 5432),
	DB_USERNAME: process.env.DB_USERNAME ?? "secop",
	DB_PASSWORD: process.env.DB_PASSWORD ?? "secop_dev",
	DB_NAME: process.env.DB_NAME ?? "secop_agent",
	DB_SCHEMA: process.env.DB_SCHEMA ?? "public",
	DB_SSL: toBoolean(process.env.DB_SSL),
	DB_LOGGING: toBoolean(process.env.DB_LOGGING),
});

/**
 * TypeORM database configuration options used by the data source.
 */
export const dataSourceOptions: DataSourceOptions = {
	type: "postgres",
	host: db.host,
	port: db.port,
	username: db.username,
	password: db.password,
	database: db.database,
	schema: db.schema,
	logging: db.logging,
	synchronize: false,
	entities: [
		SchemaHealth,
		User,
		ProcurementNotice,
		IngestionJob,
		IngestionState,
		Company,
		CompanyContract,
		MatchingResult,
		ScoreLog,
		SectorKeyword,
	],
	migrations: ["src/migrations/*.ts"],
	migrationsTableName: "typeorm_migrations",
	...(db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
};

/**
 * The default export of the configured TypeORM DataSource instance.
 */
export default new DataSource(dataSourceOptions);
