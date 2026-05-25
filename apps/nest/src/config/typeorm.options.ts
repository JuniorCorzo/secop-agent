import type { ConfigService } from "@nestjs/config";
import { SchemaHealth } from "../common/entities/schema-health.entity";
import { User } from "../modules/auth/entities/user.entity";
import { IngestionJob } from "../modules/procurement-notices/entities/ingestion-job.entity";
import { ProcurementNotice } from "../modules/procurement-notices/entities/procurement-notice.entity";
import { SectorKeyword } from "../modules/procurement-notices/entities/sector-keyword.entity";
import { IngestionState } from "../modules/soda-ingestion/entities/ingestion-state.entity";
import { Company } from "../modules/companies/entities/company.entity";
import { CompanyContract } from "../modules/companies/entities/company-contract.entity";
import { MatchingResult } from "../modules/scoring/entities/matching-result.entity";
import { databaseConfig } from "./database.config";

export const createTypeOrmOptions = (configService: ConfigService) => {
	const rawDbSsl = configService.get("DB_SSL");
	const rawDbLogging = configService.get("DB_LOGGING");
	const db = databaseConfig({
		DB_HOST: configService.getOrThrow<string>("DB_HOST"),
		DB_PORT: configService.getOrThrow<number>("DB_PORT"),
		DB_USERNAME: configService.getOrThrow<string>("DB_USERNAME"),
		DB_PASSWORD: configService.getOrThrow<string>("DB_PASSWORD"),
		DB_NAME: configService.getOrThrow<string>("DB_NAME"),
		DB_SCHEMA: configService.get<string>("DB_SCHEMA") ?? "public",
		DB_SSL: rawDbSsl as never,
		DB_LOGGING: rawDbLogging as never,
	});

	return {
		type: "postgres" as const,
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
			SectorKeyword,
		],
		...(db.ssl ? { ssl: { rejectUnauthorized: false } } : {}),
	};
};
