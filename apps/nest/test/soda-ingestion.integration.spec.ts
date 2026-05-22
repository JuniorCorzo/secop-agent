import { SodaIngestionService } from "../src/modules/soda-ingestion/services/soda-ingestion.service";

// NOTE: Bun's test runner fails evaluating TypeORM decorators on
// IngestionState entity at module load time. See soda-ingestion.service.spec.ts
describe("Soda Ingestion Integration", () => {
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

	const makeRepo = () => ({
		findOne: jest.fn().mockResolvedValue(null as any),
		create: jest.fn().mockImplementation((p) => ({
			...p,
			createdAt: new Date(),
			updatedAt: new Date(),
		})),
		save: jest.fn().mockImplementation((r) => Promise.resolve(r)),
		update: jest.fn().mockResolvedValue({ affected: 1 }),
	});

	const makeNoticeRepo = () => ({
		createQueryBuilder: jest.fn().mockReturnValue({
			select: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			getRawOne: jest.fn().mockResolvedValue(null as any),
		}),
	});

	it("streams both datasets and delegates to streamer", async () => {
		const sodaStreamer = {
			streamToQueue: jest
				.fn()
				.mockResolvedValueOnce({
					total: 10,
					enqueued: 8,
					filtered: 2,
					lastCursorValue: "2024-06-01T00:00:00.000Z",
				})
				.mockResolvedValueOnce({
					total: 5,
					enqueued: 5,
					filtered: 0,
					lastCursorValue: null,
				}),
		};
		const service = new SodaIngestionService(
			configService,
			sodaStreamer as any,
			makeRepo() as any,
			makeNoticeRepo() as any,
		);

		await service.runIngestionCycle();

		expect(sodaStreamer.streamToQueue).toHaveBeenCalledTimes(2);
		expect(sodaStreamer.streamToQueue).toHaveBeenNthCalledWith(
			1,
			"f789-7hwg",
			"SECOP_I",
			undefined,
		);
		expect(sodaStreamer.streamToQueue).toHaveBeenNthCalledWith(
			2,
			"p6dx-8zbt",
			"SECOP_II",
			undefined,
		);
	});

	it("handles partial failure gracefully with consecutive failure tracking", async () => {
		const sodaStreamer = {
			streamToQueue: jest
				.fn()
				.mockResolvedValueOnce({
					total: 10,
					enqueued: 10,
					filtered: 0,
					lastCursorValue: "2024-06-01T00:00:00.000Z",
				})
				.mockRejectedValueOnce(new Error("SECOP II API down")),
		};
		const stateRepo = makeRepo();
		const service = new SodaIngestionService(
			configService,
			sodaStreamer as any,
			stateRepo as any,
			makeNoticeRepo() as any,
		);

		// Should not throw — Promise.allSettled in runIngestionCycle
		await service.runIngestionCycle();

		expect(sodaStreamer.streamToQueue).toHaveBeenCalledTimes(2);

		// SECOP I succeeded → update called with consecutiveFailures: 0
		expect(stateRepo.update).toHaveBeenCalledWith(
			{ source: "SECOP_I" },
			{ lastCursorValue: "2024-06-01T00:00:00.000Z", consecutiveFailures: 0 },
		);

		// SECOP II failed → update called with consecutiveFailures: 1
		expect(stateRepo.update).toHaveBeenCalledWith(
			{ source: "SECOP_II" },
			{ consecutiveFailures: 1 },
		);
	});
});
