import "reflect-metadata";
import { Column, CreateDateColumn, Entity, UpdateDateColumn } from "typeorm";

/**
 * Persistent ingestion cursor state for each SODA dataset.
 *
 * Survives process restarts — unlike the old in-memory Map.
 * One row per dataset source (SECOP_I, SECOP_II).
 *
 * On bootstrap, if no row exists, the seed value is computed via
 * `SELECT MAX(source_last_updated_at) FROM procurement_notices WHERE source = $1`.
 */
@Entity({ name: "ingestion_state" })
export class IngestionState {
	/** Dataset source key (PK): "SECOP_I" | "SECOP_II" */
	@Column({ type: "varchar", length: 16, primary: true })
	source: string;

	/**
	 * Cursor value for the next incremental run.
	 * Format: ISO 8601 string from the last record's ordering field
	 * (ultima_actualizacion for SECOP_I, fecha_de_ultima_publicaci for SECOP_II).
	 *
	 * When `null`, the next cycle does a full scan (bootstrap mode).
	 */
	@Column({
		name: "last_cursor_value",
		type: "varchar",
		length: 64,
		nullable: true,
	})
	lastCursorValue: string | null;

	/** Consecutive ingestion failures for this dataset */
	@Column({
		name: "consecutive_failures",
		type: "integer",
		nullable: false,
		default: 0,
	})
	consecutiveFailures = 0;

	@CreateDateColumn({ name: "created_at", type: "timestamptz" })
	createdAt: Date;

	@UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
	updatedAt: Date;
}
