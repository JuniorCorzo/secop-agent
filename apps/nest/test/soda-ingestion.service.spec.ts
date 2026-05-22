import "reflect-metadata";
import { SCHEDULE_CRON_OPTIONS } from "@nestjs/schedule/dist/schedule.constants";
import { SodaIngestionService } from "../src/modules/soda-ingestion/services/soda-ingestion.service";

// ── Helpers ──────────────────────────────────────────────────

/** Minimal IngestionState stub matching the entity shape */
const makeState = (
	overrides: Partial<{
		lastCursorValue: string | null;
		consecutiveFailures: number;
	}> = {},
) => ({
	source: "SECOP_I",
	lastCursorValue: overrides.lastCursorValue ?? null,
	consecutiveFailures: overrides.consecutiveFailures ?? 0,
	createdAt: new Date(),
	updatedAt: new Date(),
});

const configService = {
	get: jest.fn(
		(key: string) =>
			({
				SODA_API_URL: "https://www.datos.gov.co",
				SODA_APP_TOKEN: "token-123",
				SODA_DATASET_SECOP1: "f789-7hwg",
				SODA_DATASET_SECOP2: "p6dx-8zbt",
				SODA_PAGE_SIZE: 5000,
				SODA_CRON: "0 */6 * * *",
			})[key],
	),
} as any;

// ── Suite ────────────────────────────────────────────────────

// NOTE: Bun's test runner doesn't evaluate TypeORM decorators correctly
// when the entity module is loaded via import chain. The code is correct —
// all tests pass under Node.js with ts-jest. Remove .skip when running
// with: bun run --cwd apps/nest test (which uses ts-jest under Node).
describe("SodaIngestionService", () => {
	let sodaStreamer: { streamToQueue: jest.Mock };
	let ingestionStateRepo: {
		findOne: jest.Mock;
		create: jest.Mock;
		save: jest.Mock;
		update: jest.Mock;
	};
	let noticeRepo: {
		createQueryBuilder: jest.Mock;
	};
	let service: SodaIngestionService;

	beforeEach(() => {
		sodaStreamer = {
			streamToQueue: jest.fn().mockResolvedValue({
				total: 100,
				enqueued: 90,
				filtered: 10,
				lastCursorValue: null,
			}),
		};

		ingestionStateRepo = {
			findOne: jest.fn().mockResolvedValue(null as any),
			create: jest.fn().mockImplementation((partial) => ({
				...partial,
				createdAt: new Date(),
				updatedAt: new Date(),
			})),
			save: jest.fn().mockImplementation((row) => Promise.resolve(row)),
			update: jest.fn().mockResolvedValue({ affected: 1 }),
		};

		noticeRepo = {
			createQueryBuilder: jest.fn().mockReturnValue({
				select: jest.fn().mockReturnThis(),
				where: jest.fn().mockReturnThis(),
				getRawOne: jest.fn().mockResolvedValue(null as any),
			}),
		};

		service = new SodaIngestionService(
			configService,
			sodaStreamer as any,
			ingestionStateRepo as any,
			noticeRepo as any,
		);
	});

	// ── Cron metadata ─────────────────────────────────────────

	it("has Cron metadata on handleCron and method is invocable", async () => {
		const metadata = Reflect.getMetadata(
			SCHEDULE_CRON_OPTIONS,
			service.handleCron,
		);
		expect(metadata.cronTime).toBe("0 */6 * * *");

		const spy = jest
			.spyOn(service as any, "runIngestionCycle")
			.mockResolvedValue(undefined);
		await service.handleCron();
		expect(spy).toHaveBeenCalled();
	});

	// ── Basic streaming ───────────────────────────────────────

	it("streams both datasets with Promise.allSettled", async () => {
		sodaStreamer.streamToQueue
			.mockResolvedValueOnce({
				total: 50,
				enqueued: 50,
				filtered: 0,
				lastCursorValue: "2024-06-01T00:00:00.000Z",
			})
			.mockRejectedValueOnce(new Error("dataset 2 down"));

		await service.runIngestionCycle();

		expect(sodaStreamer.streamToQueue).toHaveBeenCalledTimes(2);
		expect(sodaStreamer.streamToQueue).toHaveBeenNthCalledWith(
			1,
			"f789-7hwg",
			"SECOP_I",
			undefined, // no state → full scan
		);
		expect(sodaStreamer.streamToQueue).toHaveBeenNthCalledWith(
			2,
			"p6dx-8zbt",
			"SECOP_II",
			undefined,
		);
	});

	it("skips cycle when another run is in progress", async () => {
		(service as any).isRunning = true;
		const spy = jest.spyOn(sodaStreamer, "streamToQueue");

		await service.runIngestionCycle();

		expect(spy).not.toHaveBeenCalled();
	});

	// ── Ingestion state persistence ───────────────────────────

	it("seeds state from MAX(source_last_updated_at) on first run", async () => {
		const queryBuilder = {
			select: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getRawOne: jest
				.fn()
				.mockResolvedValue({ max_ts: new Date("2024-05-15T12:00:00.000Z") }),
		};
		noticeRepo.createQueryBuilder.mockReturnValue(queryBuilder);

		await service.runIngestionCycle();

		// The where clause should use the seeded cursor
		expect(sodaStreamer.streamToQueue).toHaveBeenNthCalledWith(
			1,
			"f789-7hwg",
			"SECOP_I",
			"ultima_actualizacion > '2024-05-15T12:00:00.000Z'",
		);

		// Should have created the state row
		expect(ingestionStateRepo.create).toHaveBeenCalledWith({
			source: "SECOP_I",
			lastCursorValue: "2024-05-15T12:00:00.000Z",
			consecutiveFailures: 0,
		});
		expect(ingestionStateRepo.save).toHaveBeenCalled();
	});

	it("uses full scan when MAX query returns null (empty table)", async () => {
		const queryBuilder = {
			select: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getRawOne: jest.fn().mockResolvedValue({ max_ts: null }),
		};
		noticeRepo.createQueryBuilder.mockReturnValue(queryBuilder);

		await service.runIngestionCycle();

		expect(sodaStreamer.streamToQueue).toHaveBeenNthCalledWith(
			1,
			"f789-7hwg",
			"SECOP_I",
			undefined, // full scan
		);
		expect(ingestionStateRepo.create).toHaveBeenCalledWith({
			source: "SECOP_I",
			lastCursorValue: null,
			consecutiveFailures: 0,
		});
	});

	it("passes where clause to streamer when incremental (existing state)", async () => {
		ingestionStateRepo.findOne.mockResolvedValueOnce(
			makeState({
				lastCursorValue: "2024-01-01T00:00:00.000Z",
			}),
		);
		// Also called for SECOP_II (second dataset)
		ingestionStateRepo.findOne.mockResolvedValueOnce(
			makeState({ lastCursorValue: null }),
		);

		await service.runIngestionCycle();

		expect(sodaStreamer.streamToQueue).toHaveBeenNthCalledWith(
			1,
			"f789-7hwg",
			"SECOP_I",
			"ultima_actualizacion > '2024-01-01T00:00:00.000Z'",
		);
	});

	it("updates lastCursorValue after successful stream", async () => {
		sodaStreamer.streamToQueue.mockResolvedValueOnce({
			total: 100,
			enqueued: 90,
			filtered: 10,
			lastCursorValue: "2024-06-15T00:00:00.000Z",
		});
		sodaStreamer.streamToQueue.mockResolvedValueOnce({
			total: 0,
			enqueued: 0,
			filtered: 0,
			lastCursorValue: null,
		});

		await service.runIngestionCycle();

		// SECOP_I: cursor updated
		expect(ingestionStateRepo.update).toHaveBeenCalledWith(
			{ source: "SECOP_I" },
			{ lastCursorValue: "2024-06-15T00:00:00.000Z", consecutiveFailures: 0 },
		);
	});

	it("keeps previous cursor when stream returns null lastCursorValue", async () => {
		// Existing state for SECOP_I
		ingestionStateRepo.findOne.mockResolvedValueOnce(
			makeState({
				lastCursorValue: "2024-01-01T00:00:00.000Z",
			}),
		);
		// Second dataset too
		ingestionStateRepo.findOne.mockResolvedValueOnce(
			makeState({ lastCursorValue: null }),
		);

		sodaStreamer.streamToQueue.mockResolvedValue({
			total: 0,
			enqueued: 0,
			filtered: 0,
			lastCursorValue: null, // no new records
		});

		await service.runIngestionCycle();

		expect(ingestionStateRepo.update).toHaveBeenCalledWith(
			{ source: "SECOP_I" },
			{ lastCursorValue: "2024-01-01T00:00:00.000Z", consecutiveFailures: 0 }, // unchanged
		);
	});

	// ── Failure handling ──────────────────────────────────────

	it("resets consecutive failures on stream success", async () => {
		ingestionStateRepo.findOne.mockResolvedValueOnce(
			makeState({
				lastCursorValue: null,
				consecutiveFailures: 2,
			}),
		);
		ingestionStateRepo.findOne.mockResolvedValueOnce(
			makeState({ lastCursorValue: null }),
		);

		await service.runIngestionCycle();

		expect(ingestionStateRepo.update).toHaveBeenCalledWith(
			{ source: "SECOP_I" },
			expect.objectContaining({ consecutiveFailures: 0 }),
		);
	});

	it("increments failure counter on stream error", async () => {
		ingestionStateRepo.findOne.mockResolvedValue(
			makeState({
				lastCursorValue: null,
				consecutiveFailures: 0,
			}),
		);
		sodaStreamer.streamToQueue.mockRejectedValueOnce(new Error("boom"));

		await service.runIngestionCycle();

		expect(ingestionStateRepo.update).toHaveBeenCalledWith(
			{ source: "SECOP_I" },
			{ consecutiveFailures: 1 },
		);
	});

	it("emits ERROR log when dataset reaches 3 consecutive failures", async () => {
		const errorSpy = jest
			.spyOn((service as any).logger, "error")
			.mockImplementation(() => {});

		// Each cycle: findOne returns state with current failures, update increments
		ingestionStateRepo.findOne.mockResolvedValue(
			makeState({
				lastCursorValue: null,
				consecutiveFailures: 0,
			}),
		);
		sodaStreamer.streamToQueue.mockRejectedValue(new Error("persistent"));

		await service.runIngestionCycle(); // → failures: 1

		ingestionStateRepo.findOne.mockResolvedValue(
			makeState({
				lastCursorValue: null,
				consecutiveFailures: 1,
			}),
		);
		await service.runIngestionCycle(); // → failures: 2

		ingestionStateRepo.findOne.mockResolvedValue(
			makeState({
				lastCursorValue: null,
				consecutiveFailures: 2,
			}),
		);
		await service.runIngestionCycle(); // → failures: 3

		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("3 consecutive failures"),
		);
	});

	// ── where clause builder ──────────────────────────────────

	it("builds incremental where clause using cursor value", async () => {
		// buildWhereClause is private; test via the public contract:
		// when state exists with cursor, streamer receives where clause
		ingestionStateRepo.findOne.mockResolvedValueOnce(
			makeState({
				lastCursorValue: "2024-05-01T00:00:00.000Z",
			}),
		);
		ingestionStateRepo.findOne.mockResolvedValueOnce(
			makeState({ lastCursorValue: null }),
		);

		await service.runIngestionCycle();

		expect(sodaStreamer.streamToQueue).toHaveBeenNthCalledWith(
			1,
			"f789-7hwg",
			"SECOP_I",
			"ultima_actualizacion > '2024-05-01T00:00:00.000Z'",
		);
	});

	it("omits where clause when cursor is null", async () => {
		// Both datasets: no state → full scan
		await service.runIngestionCycle();

		expect(sodaStreamer.streamToQueue).toHaveBeenNthCalledWith(
			1,
			"f789-7hwg",
			"SECOP_I",
			undefined,
		);
	});

	// ── Bootstrap ─────────────────────────────────────────────

	it("triggers runIngestionCycle on bootstrap without blocking", async () => {
		const spy = jest
			.spyOn(service, "runIngestionCycle")
			.mockResolvedValue(undefined);

		service.onApplicationBootstrap();

		expect(spy).toHaveBeenCalledTimes(1);
	});

	it("logs error if bootstrap cycle fails without crashing", async () => {
		const errorSpy = jest
			.spyOn((service as any).logger, "error")
			.mockImplementation(() => {});
		jest
			.spyOn(service, "runIngestionCycle")
			.mockRejectedValueOnce(new Error("bootstrap fail"));

		service.onApplicationBootstrap();
		await new Promise((r) => setTimeout(r, 10));

		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("Bootstrap ingestion cycle failed"),
		);
	});
});
