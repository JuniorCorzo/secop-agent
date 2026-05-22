import { ProcurementIngestionWorker } from "../src/modules/queues/workers/procurement-ingestion.worker";
import { IngestionJobStatus } from "../src/modules/procurement-notices/entities/ingestion-job.entity";
import { NewProcurementNoticeEvent } from "../src/modules/procurement-notices/events/new-procurement-notice.event";

describe("ProcurementIngestionWorker", () => {
	let worker: ProcurementIngestionWorker;
	let repository: jest.Mocked<any>;
	let ingestionJobRepository: jest.Mocked<any>;
	let eventEmitter: jest.Mocked<any>;

	const INGESTION_JOB_ID = "ingestion-job-123";

	beforeEach(() => {
		repository = {
			find: jest.fn().mockResolvedValue([]),
			upsert: jest.fn().mockResolvedValue(undefined),
		};

		ingestionJobRepository = {
			update: jest.fn().mockResolvedValue(undefined),
		};

		eventEmitter = {
			emit: jest.fn(),
		};

		worker = new ProcurementIngestionWorker(
			repository,
			ingestionJobRepository,
			eventEmitter,
		);
	});

	function makeRecords(
		count: number,
	): Array<{ secopId: string; title: string }> {
		return Array.from({ length: count }, (_, i) => ({
			secopId: `SECOP-${i}`,
			title: `Notice ${i}`,
		}));
	}

	describe("chunking", () => {
		it("processes 150 records in 1 chunk of 5000", async () => {
			const records = makeRecords(150);
			repository.find
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce(
					records.map((record, index) => ({
						id: `uuid-${index}`,
						secopId: record.secopId,
					})),
				);

			const result = await worker.process(INGESTION_JOB_ID, records);

			expect(repository.upsert).toHaveBeenCalledTimes(1);
			expect(result.created).toBe(150);
			expect(result.updated).toBe(0);
			expect(result.failed).toBe(0);
		});

		it("processes a single record in one chunk", async () => {
			const records = makeRecords(1);

			await worker.process(INGESTION_JOB_ID, records);

			expect(repository.upsert).toHaveBeenCalledTimes(1);
			expect(repository.upsert).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ secopId: "SECOP-0" }),
				]),
				["secopId"],
			);
		});

		it("processes 50 records in exactly one chunk", async () => {
			const records = makeRecords(50);

			await worker.process(INGESTION_JOB_ID, records);

			expect(repository.upsert).toHaveBeenCalledTimes(1);
		});

		it("processes 5100 records in two chunks (5000 + 100)", async () => {
			const records = makeRecords(5100);

			await worker.process(INGESTION_JOB_ID, records);

			expect(repository.upsert).toHaveBeenCalledTimes(2);
		});
	});

	describe("deduplication", () => {
		it("keeps the last occurrence when duplicate secopIds exist", async () => {
			const records = [
				{ secopId: "SECOP-DUP", title: "First" },
				{ secopId: "SECOP-DUP", title: "Second" },
				{ secopId: "SECOP-UNIQUE", title: "Unique" },
			];
			repository.find.mockResolvedValueOnce([]).mockResolvedValueOnce([
				{ id: "uuid-1", secopId: "SECOP-DUP" },
				{ id: "uuid-2", secopId: "SECOP-UNIQUE" },
			]);

			const result = await worker.process(INGESTION_JOB_ID, records);

			expect(repository.upsert).toHaveBeenCalledTimes(1);
			expect(repository.upsert).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({ secopId: "SECOP-DUP", title: "Second" }),
					expect.objectContaining({ secopId: "SECOP-UNIQUE", title: "Unique" }),
				]),
				["secopId"],
			);
			expect(result.created).toBe(2);
		});
	});

	describe("created vs updated counts", () => {
		it("counts existing records as updated", async () => {
			repository.find
				.mockResolvedValueOnce([{ secopId: "SECOP-0" }, { secopId: "SECOP-2" }])
				.mockResolvedValueOnce(
					makeRecords(5).map((record, index) => ({
						id: `uuid-${index}`,
						secopId: record.secopId,
					})),
				);

			const records = makeRecords(5);
			const result = await worker.process(INGESTION_JOB_ID, records);

			expect(result.updated).toBe(2);
			expect(result.created).toBe(3);
			expect(result.failed).toBe(0);
		});

		it("counts all new records as created when none exist", async () => {
			repository.find
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce(
					makeRecords(10).map((record, index) => ({
						id: `uuid-${index}`,
						secopId: record.secopId,
					})),
				);

			const records = makeRecords(10);
			const result = await worker.process(INGESTION_JOB_ID, records);

			expect(result.created).toBe(10);
			expect(result.updated).toBe(0);
		});

		it("counts all existing records as updated", async () => {
			repository.find.mockResolvedValue([
				{ secopId: "SECOP-0" },
				{ secopId: "SECOP-1" },
				{ id: "uuid-0", secopId: "SECOP-0" },
				{ id: "uuid-1", secopId: "SECOP-1" },
			]);

			const records = makeRecords(2);
			const result = await worker.process(INGESTION_JOB_ID, records);

			expect(result.created).toBe(0);
			expect(result.updated).toBe(2);
		});
	});

	describe("error handling", () => {
		it("marks chunk as failed when upsert throws", async () => {
			repository.upsert
				.mockRejectedValueOnce(new Error("DB timeout"))
				.mockResolvedValue(undefined);
			repository.find.mockResolvedValueOnce([]).mockResolvedValueOnce(
				makeRecords(100)
					.slice(0, 100)
					.map((record, index) => ({
						id: `uuid-${index}`,
						secopId: record.secopId,
					})),
			);

			const records = makeRecords(5100); // 2 chunks: 5000 + 100
			const result = await worker.process(INGESTION_JOB_ID, records);

			expect(repository.upsert).toHaveBeenCalledTimes(2);
			expect(result.failed).toBe(5000);
			expect(result.created).toBe(100);
			expect(result.errors).toHaveLength(5000);
			expect(result.errors[0]).toEqual({
				secopId: "SECOP-0",
				reason: "DB timeout",
			});
			expect(ingestionJobRepository.update).toHaveBeenLastCalledWith(
				"ingestion-job-123",
				expect.objectContaining({
					status: IngestionJobStatus.PARTIAL,
					failedCount: 5000,
				}),
			);
		});

		it("continues processing remaining chunks after one fails", async () => {
			repository.upsert
				.mockResolvedValueOnce(undefined)
				.mockRejectedValueOnce(new Error("DB error"))
				.mockResolvedValueOnce(undefined);

			const records = makeRecords(10100);
			const result = await worker.process(INGESTION_JOB_ID, records);

			expect(repository.upsert).toHaveBeenCalledTimes(3);
			expect(result.created).toBe(5100);
			expect(result.failed).toBe(5000);
			expect(result.errors).toHaveLength(5000);
		});

		it("returns all failed when every chunk errors", async () => {
			repository.upsert.mockRejectedValue(new Error("Total failure"));

			const records = makeRecords(5000);
			const result = await worker.process(INGESTION_JOB_ID, records);

			expect(result.created).toBe(0);
			expect(result.updated).toBe(0);
			expect(result.failed).toBe(5000);
			expect(result.errors).toHaveLength(5000);
		});

		it("handles empty records gracefully", async () => {
			const result = await worker.process(INGESTION_JOB_ID, []);

			expect(repository.find).not.toHaveBeenCalled();
			expect(repository.upsert).not.toHaveBeenCalled();
			expect(result).toEqual({ created: 0, updated: 0, failed: 0, errors: [] });
		});

		it("emits one event per persisted notice after successful upsert", async () => {
			const records = makeRecords(2);
			repository.find.mockResolvedValueOnce([]).mockResolvedValueOnce([
				{ id: "uuid-1", secopId: "SECOP-0" },
				{ id: "uuid-2", secopId: "SECOP-1" },
			]);

			await worker.process(INGESTION_JOB_ID, records);

			expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
			expect(eventEmitter.emit).toHaveBeenCalledWith(
				NewProcurementNoticeEvent.EVENT_NAME,
				expect.objectContaining({
					ingestionJobId: INGESTION_JOB_ID,
					procurementNoticeId: "uuid-1",
					secopId: "SECOP-0",
					action: "created",
				}),
			);
		});

		it("persists rawData from sourceMetadata on new insert", async () => {
			const records = [
				{
					secopId: "SECOP-RAW-1",
					title: "Notice raw",
					sourceMetadata: { upstream: "payload-v1" },
				} as any,
			];
			repository.find
				.mockResolvedValueOnce([])
				.mockResolvedValueOnce([{ id: "uuid-raw-1", secopId: "SECOP-RAW-1" }]);

			await worker.process(INGESTION_JOB_ID, records);

			expect(repository.upsert).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						secopId: "SECOP-RAW-1",
						rawData: { upstream: "payload-v1" },
					}),
				]),
				["secopId"],
			);
		});

		it("keeps latest accepted rawData semantics on upsert", async () => {
			const records = [
				{
					secopId: "SECOP-RAW-2",
					title: "Notice raw 2",
					sourceMetadata: { upstream: "payload-v2" },
				} as any,
			];
			repository.find
				.mockResolvedValueOnce([{ secopId: "SECOP-RAW-2" }])
				.mockResolvedValueOnce([{ id: "uuid-raw-2", secopId: "SECOP-RAW-2" }]);

			await worker.process(INGESTION_JOB_ID, records);

			expect(repository.upsert).toHaveBeenCalledWith(
				expect.arrayContaining([
					expect.objectContaining({
						secopId: "SECOP-RAW-2",
						rawData: { upstream: "payload-v2" },
					}),
				]),
				["secopId"],
			);
		});

		it("does not emit events when persistence fails", async () => {
			repository.upsert.mockRejectedValueOnce(new Error("DB timeout"));

			await worker.process(INGESTION_JOB_ID, makeRecords(2));

			expect(eventEmitter.emit).not.toHaveBeenCalled();
		});
	});
});
