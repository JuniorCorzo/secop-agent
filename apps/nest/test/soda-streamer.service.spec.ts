import { SodaStreamerService } from "../src/modules/soda-ingestion/services/soda-streamer.service";

const IngestionJobStatus = {
	ACCEPTED: "ACCEPTED",
	PROCESSING: "PROCESSING",
	COMPLETED: "COMPLETED",
	PARTIAL: "PARTIAL",
	FAILED: "FAILED",
} as const;

describe("SodaStreamerService", () => {
	const configService = {
		get: jest.fn(
			(key: string) =>
				({
					SODA_API_URL: "https://www.datos.gov.co",
					SODA_APP_TOKEN: "token-123",
					SODA_DATASET_SECOP1: "f789-7hwg",
					SODA_DATASET_SECOP2: "p6dx-8zbt",
					SODA_PAGE_SIZE: 2,
					SODA_CRON: "0 */6 * * *",
				})[key],
		),
	} as any;

	let sodaClientService: { queryDataset: jest.Mock };
	let procurementIngestionProducer: { add: jest.Mock };
	let ingestionJobRepository: {
		create: jest.Mock;
		save: jest.Mock;
		update: jest.Mock;
	};
	let service: SodaStreamerService;

	function makeSecopRecord(
		id: string,
		title: string,
		extra?: Record<string, unknown>,
	) {
		return {
			numero_de_constancia: id,
			objeto_a_contratar: title,
			ultima_actualizacion: `2024-01-${String(Number(id.slice(-2)) || 1).padStart(2, "0")}T00:00:00.000Z`,
			...extra,
		};
	}

	beforeEach(() => {
		sodaClientService = { queryDataset: jest.fn() };
		procurementIngestionProducer = {
			add: jest.fn().mockResolvedValue(undefined),
		};
		ingestionJobRepository = {
			create: jest.fn().mockReturnValue({ id: "tracking-job-1" }),
			save: jest.fn().mockResolvedValue({ id: "tracking-job-1" }),
			update: jest.fn().mockResolvedValue(undefined),
		};
		service = new SodaStreamerService(
			sodaClientService as any,
			procurementIngestionProducer as any,
			ingestionJobRepository as any,
			configService,
		);
	});

	it("creates an IngestionJob and updates it to PROCESSING", async () => {
		sodaClientService.queryDataset.mockResolvedValue([]);

		await service.streamToQueue("f789-7hwg", "SECOP_I");

		expect(ingestionJobRepository.create).toHaveBeenCalledWith(
			expect.objectContaining({ status: IngestionJobStatus.ACCEPTED }),
		);
		expect(ingestionJobRepository.save).toHaveBeenCalled();
		expect(ingestionJobRepository.update).toHaveBeenCalledWith(
			"tracking-job-1",
			{
				status: IngestionJobStatus.PROCESSING,
			},
		);
	});

	it("fetches pages via cursor and stops when page is smaller than pageSize", async () => {
		sodaClientService.queryDataset
			.mockResolvedValueOnce([
				makeSecopRecord("C-001", "Notice 1"),
				makeSecopRecord("C-002", "Notice 2"),
			])
			.mockResolvedValueOnce([makeSecopRecord("C-003", "Notice 3")]); // only 1 record → end

		const result = await service.streamToQueue("f789-7hwg", "SECOP_I");

		expect(sodaClientService.queryDataset).toHaveBeenCalledTimes(2);
		// First page: null cursor → no cursor WHERE clause
		expect(sodaClientService.queryDataset).toHaveBeenNthCalledWith(
			1,
			"f789-7hwg",
			{
				query: expect.stringContaining("SELECT"),
				pageNumber: 1,
				pageSize: 2,
			},
		);
		// Second page: cursor from last record of page 1
		expect(sodaClientService.queryDataset).toHaveBeenNthCalledWith(
			2,
			"f789-7hwg",
			{
				query: expect.stringContaining("SELECT"),
				pageNumber: 1,
				pageSize: 2,
			},
		);
		expect(result.total).toBe(3);
		expect(result.enqueued).toBe(3);
		expect(result.filtered).toBe(0);
	});

	it("passes incremental whereClause through to cursor pages", async () => {
		sodaClientService.queryDataset.mockResolvedValue([]);

		await service.streamToQueue(
			"p6dx-8zbt",
			"SECOP_II",
			"fecha_de_ultima_publicaci > '2024-01-01'",
		);

		expect(sodaClientService.queryDataset).toHaveBeenCalledWith("p6dx-8zbt", {
			query: expect.stringContaining(
				"fecha_de_ultima_publicaci > '2024-01-01'",
			),
			pageNumber: 1,
			pageSize: 2,
		});
	});

	it("enqueues records in micro-batches of MICRO_BATCH_SIZE (1000)", async () => {
		// Generate 1500 records — should produce 2 jobs (1000 + 500)
		const records = Array.from({ length: 1500 }, (_, i) =>
			makeSecopRecord(`C-${String(i).padStart(4, "0")}`, `Notice ${i}`),
		);
		// Override pageSize via configService to return 500 per page
		const customConfigService = {
			get: jest.fn(
				(key: string) =>
					({
						SODA_API_URL: "https://www.datos.gov.co",
						SODA_APP_TOKEN: "token-123",
						SODA_DATASET_SECOP1: "f789-7hwg",
						SODA_DATASET_SECOP2: "p6dx-8zbt",
						SODA_PAGE_SIZE: 500,
						SODA_CRON: "0 */6 * * *",
					})[key],
			),
		} as any;
		const customService = new SodaStreamerService(
			{ queryDataset: jest.fn() } as any,
			procurementIngestionProducer as any,
			ingestionJobRepository as any,
			customConfigService,
		);

		(customService as any).sodaClientService.queryDataset
			.mockResolvedValueOnce(records.slice(0, 500))
			.mockResolvedValueOnce(records.slice(500, 1000))
			.mockResolvedValueOnce(records.slice(1000, 1500))
			.mockResolvedValue([]);

		await customService.streamToQueue("f789-7hwg", "SECOP_I");

		expect(procurementIngestionProducer.add).toHaveBeenCalledTimes(2);
		expect(procurementIngestionProducer.add).toHaveBeenNthCalledWith(
			1,
			expect.objectContaining({
				ingestionJobId: "tracking-job-1",
				records: expect.arrayContaining([
					expect.objectContaining({ secopId: "C-0000" }),
				]),
			}),
		);
		// First job should have 1000 records
		expect(
			procurementIngestionProducer.add.mock.calls[0][0].records,
		).toHaveLength(1000);
		// Second job should have 500 records (remainder)
		expect(
			procurementIngestionProducer.add.mock.calls[1][0].records,
		).toHaveLength(500);
	});

	it("filters out CANCELLED and REJECTED records", async () => {
		sodaClientService.queryDataset
			.mockResolvedValueOnce([
				makeSecopRecord("C-001", "Active"),
				makeSecopRecord("C-002", "Cancelled", {
					estado_del_proceso: "Descartado",
				}),
				makeSecopRecord("C-003", "Rejected", {
					estado_del_proceso: "Descartado",
				}),
				makeSecopRecord("C-004", "Another Active"),
			])
			.mockResolvedValue([]);

		// Mock the mapper — Descartado maps to REJECTED in secop-i.mapper
		const result = await service.streamToQueue("f789-7hwg", "SECOP_I");

		expect(result.total).toBe(4);
		expect(result.enqueued).toBe(2);
		expect(result.filtered).toBe(2);

		// Only 2 active records should be enqueued
		expect(procurementIngestionProducer.add).toHaveBeenCalledTimes(1);
		expect(
			procurementIngestionProducer.add.mock.calls[0][0].records,
		).toHaveLength(2);
		expect(
			procurementIngestionProducer.add.mock.calls[0][0].records[0].secopId,
		).toBe("C-001");
		expect(
			procurementIngestionProducer.add.mock.calls[0][0].records[1].secopId,
		).toBe("C-004");
	});

	it("marks IngestionJob as COMPLETED when stream finishes", async () => {
		sodaClientService.queryDataset.mockResolvedValue([]);

		await service.streamToQueue("f789-7hwg", "SECOP_I");

		expect(ingestionJobRepository.update).toHaveBeenLastCalledWith(
			"tracking-job-1",
			{
				status: IngestionJobStatus.COMPLETED,
				createdCount: 0,
			},
		);
	});

	it("marks IngestionJob as FAILED on stream error", async () => {
		sodaClientService.queryDataset.mockRejectedValueOnce(new Error("API down"));

		await expect(service.streamToQueue("f789-7hwg", "SECOP_I")).rejects.toThrow(
			"API down",
		);

		expect(ingestionJobRepository.update).toHaveBeenLastCalledWith(
			"tracking-job-1",
			{
				status: IngestionJobStatus.FAILED,
				errors: [{ secopId: "STREAM", reason: "API down" }],
			},
		);
	});

	it("handles empty dataset gracefully", async () => {
		sodaClientService.queryDataset.mockResolvedValue([]);

		const result = await service.streamToQueue("f789-7hwg", "SECOP_I");

		expect(result.total).toBe(0);
		expect(result.enqueued).toBe(0);
		expect(result.filtered).toBe(0);
		expect(procurementIngestionProducer.add).not.toHaveBeenCalled();
	});

	it("enqueues partial batch on last page", async () => {
		sodaClientService.queryDataset.mockResolvedValueOnce([
			makeSecopRecord("C-001", "Only one"),
		]);

		const result = await service.streamToQueue("f789-7hwg", "SECOP_I");

		expect(procurementIngestionProducer.add).toHaveBeenCalledTimes(1);
		expect(
			procurementIngestionProducer.add.mock.calls[0][0].records,
		).toHaveLength(1);
		expect(result.enqueued).toBe(1);
	});
});
