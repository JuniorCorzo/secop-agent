import { of, throwError } from "rxjs";
import { SodaClientService } from "../src/modules/soda-ingestion/services/soda-client.service";

describe("SodaClientService", () => {
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

	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("builds dataset query URL", () => {
		const service = new SodaClientService(
			{ get: jest.fn() } as any,
			configService,
		);
		expect(service.buildUrl("f789-7hwg")).toBe(
			"https://www.datos.gov.co/api/v3/views/f789-7hwg/query.json",
		);
	});

	describe("queryDataset (SODA 3.0 POST with SoQL)", () => {
		it("sends POST with JSON body containing query and page", async () => {
			const httpService = {
				post: jest.fn().mockReturnValue(of({ data: [{ id: 1 }] })),
			} as any;
			const service = new SodaClientService(httpService, configService);

			const page = await service.queryDataset("f789-7hwg", {
				query: "SELECT id WHERE id > '1' ORDER BY id ASC",
				pageNumber: 1,
				pageSize: 2,
			});

			expect(page).toEqual([{ id: 1 }]);
			expect(httpService.post).toHaveBeenCalledWith(
				expect.stringContaining("/api/v3/views/f789-7hwg/query.json"),
				{
					query: "SELECT id WHERE id > '1' ORDER BY id ASC",
					page: { pageNumber: 1, pageSize: 2 },
					includeSystem: false,
					includeSynthetic: false,
				},
				expect.objectContaining({
					headers: {
						"Content-Type": "application/json",
						"X-App-Token": "token-123",
					},
					timeout: 30000,
				}),
			);
		});

		it("handles array response directly", async () => {
			const httpService = {
				post: jest.fn().mockReturnValue(of({ data: [{ a: 1 }, { a: 2 }] })),
			} as any;
			const service = new SodaClientService(httpService, configService);

			const page = await service.queryDataset("f789-7hwg", {
				query: "SELECT a",
				pageNumber: 1,
				pageSize: 5,
			});

			expect(page).toEqual([{ a: 1 }, { a: 2 }]);
		});

		it("handles wrapped response (results/data)", async () => {
			const httpService = {
				post: jest.fn().mockReturnValue(of({ data: { results: [{ b: 3 }] } })),
			} as any;
			const service = new SodaClientService(httpService, configService);

			const page = await service.queryDataset("f789-7hwg", {
				query: "SELECT b",
				pageNumber: 1,
				pageSize: 5,
			});

			expect(page).toEqual([{ b: 3 }]);
		});

		it("retries failed POST and eventually succeeds", async () => {
			const httpService = {
				post: jest
					.fn()
					.mockReturnValueOnce(throwError(() => new Error("network")))
					.mockReturnValueOnce(throwError(() => new Error("network")))
					.mockReturnValueOnce(of({ data: [{ id: 2 }] })),
			} as any;
			const service = new SodaClientService(httpService, configService);

			const page = await service.queryDataset("f789-7hwg", {
				query: "SELECT id",
				pageNumber: 1,
				pageSize: 2,
			});

			expect(page).toEqual([{ id: 2 }]);
			expect(httpService.post).toHaveBeenCalledTimes(3);
		});

		it("throws after exhausting all 3 retries", async () => {
			const httpService = {
				post: jest
					.fn()
					.mockReturnValueOnce(throwError(() => new Error("fail 1")))
					.mockReturnValueOnce(throwError(() => new Error("fail 2")))
					.mockReturnValueOnce(throwError(() => new Error("fail 3"))),
			} as any;
			const service = new SodaClientService(httpService, configService);

			const result = await service
				.queryDataset("f789-7hwg", {
					query: "SELECT id",
					pageNumber: 1,
					pageSize: 2,
				})
				.catch((e) => e);

			expect(result).toBeInstanceOf(Error);
			expect(result.message).toBe("fail 3");
			expect(httpService.post).toHaveBeenCalledTimes(3);
		});
	});

	describe("paginateDataset (legacy offset)", () => {
		it("paginates until page is smaller than pageSize", async () => {
			const service = new SodaClientService(
				{ get: jest.fn() } as any,
				configService,
			);
			const querySpy = jest
				.spyOn(service, "queryDataset")
				.mockResolvedValueOnce([{ id: 1 }, { id: 2 }] as any)
				.mockResolvedValueOnce([{ id: 3 }] as any);

			const results = await service.paginateDataset("f789-7hwg");

			expect(results).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
			expect(querySpy).toHaveBeenCalledTimes(2);
		});

		it("builds SELECT * query when no columns specified", async () => {
			const querySpy = jest
				.spyOn(SodaClientService.prototype, "queryDataset")
				.mockResolvedValue([]);

			const service = new SodaClientService(
				{ get: jest.fn() } as any,
				configService,
			);
			await service.paginateDataset("f789-7hwg");

			expect(querySpy).toHaveBeenCalledWith("f789-7hwg", {
				query: "SELECT *",
				pageNumber: 1,
				pageSize: 2,
			});
			querySpy.mockRestore();
		});

		it("includes WHERE and ORDER BY in query when provided", async () => {
			const querySpy = jest
				.spyOn(SodaClientService.prototype, "queryDataset")
				.mockResolvedValue([]);

			const service = new SodaClientService(
				{ get: jest.fn() } as any,
				configService,
			);
			await service.paginateDataset("f789-7hwg", "id > '1'", "fecha", ["id"]);

			expect(querySpy).toHaveBeenCalledWith("f789-7hwg", {
				query: "SELECT id WHERE (id > '1') ORDER BY fecha DESC",
				pageNumber: 1,
				pageSize: 2,
			});
			querySpy.mockRestore();
		});
	});
});
