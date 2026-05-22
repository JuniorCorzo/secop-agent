import { plainToInstance, Transform, Type } from "class-transformer";
import {
	IsBoolean,
	IsIn,
	IsNumber,
	IsNotEmpty,
	IsOptional,
	IsString,
	validateSync,
} from "class-validator";

export class EnvironmentVariables {
	@Type(() => Number)
	@IsNumber()
	PORT!: number;

	@IsIn(["development", "test", "production"])
	NODE_ENV!: string;

	@IsString()
	DB_HOST!: string;

	@Type(() => Number)
	@IsNumber()
	DB_PORT!: number;

	@IsString()
	DB_USERNAME!: string;

	@IsString()
	DB_PASSWORD!: string;

	@IsString()
	DB_NAME!: string;

	@IsOptional()
	@IsString()
	DB_SCHEMA?: string;

	@Transform(({ value }) => value === true || value === "true")
	@IsBoolean()
	DB_SSL!: boolean;

	@Transform(({ value }) => value === true || value === "true")
	@IsBoolean()
	DB_LOGGING!: boolean;

	@IsString()
	@IsNotEmpty()
	JWT_SECRET?: string;

	@IsString()
	@IsNotEmpty()
	JWT_EXPIRES_IN?: string;

	@IsString()
	@IsNotEmpty()
	ADMIN_EMAIL?: string;

	@IsString()
	@IsNotEmpty()
	ADMIN_PASSWORD?: string;

	@IsString()
	@IsNotEmpty()
	REDIS_HOST?: string;

	@Type(() => Number)
	@IsNumber()
	REDIS_PORT?: number;

	@IsOptional()
	@IsString()
	REDIS_PASSWORD?: string;

	@IsString()
	@IsNotEmpty()
	LLM_BASE_URL?: string;

	@IsString()
	@IsNotEmpty()
	LLM_API_KEY?: string;

	@IsString()
	@IsNotEmpty()
	HERMES_BASE_URL?: string;

	// SODA Ingestion
	@IsOptional()
	@IsString()
	SODA_API_URL?: string;

	@IsOptional()
	@IsString()
	SODA_APP_TOKEN?: string;

	@IsOptional()
	@IsString()
	SODA_DATASET_SECOP1?: string;

	@IsOptional()
	@IsString()
	SODA_DATASET_SECOP2?: string;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	SODA_PAGE_SIZE?: number;

	@IsOptional()
	@Type(() => Number)
	@IsNumber()
	SODA_MAX_PAGES?: number;

	@IsOptional()
	@IsString()
	SODA_CRON?: string;

	/** ISO 8601 date string — only ingest records updated after this date. */
	@IsOptional()
	@IsString()
	SODA_SINCE?: string;
}

export type EnvironmentConfig = Pick<
	EnvironmentVariables,
	| "PORT"
	| "NODE_ENV"
	| "DB_HOST"
	| "DB_PORT"
	| "DB_USERNAME"
	| "DB_PASSWORD"
	| "DB_NAME"
	| "DB_SCHEMA"
	| "DB_SSL"
	| "DB_LOGGING"
	| "JWT_SECRET"
	| "JWT_EXPIRES_IN"
	| "ADMIN_EMAIL"
	| "ADMIN_PASSWORD"
	| "REDIS_HOST"
	| "REDIS_PORT"
	| "REDIS_PASSWORD"
	| "LLM_BASE_URL"
	| "LLM_API_KEY"
	| "HERMES_BASE_URL"
	| "SODA_API_URL"
	| "SODA_APP_TOKEN"
	| "SODA_DATASET_SECOP1"
	| "SODA_DATASET_SECOP2"
	| "SODA_PAGE_SIZE"
	| "SODA_MAX_PAGES"
	| "SODA_CRON"
	| "SODA_SINCE"
>;

export const validateEnvironment = (
	config: Record<string, unknown>,
): EnvironmentConfig => {
	const validatedConfig = plainToInstance(EnvironmentVariables, config, {
		enableImplicitConversion: false,
	});

	const errors = validateSync(validatedConfig, {
		skipMissingProperties: false,
		whitelist: true,
	});

	if (errors.length > 0) {
		throw new Error(
			`Environment validation failed: ${errors.map((error) => `${error.property}`).join(", ")}`,
		);
	}

	return validatedConfig as EnvironmentConfig;
};
