import {
	deduplicateRecords,
	toEntityShape,
	type IngestionRecord,
	type IngestionJobResult,
} from "../src/modules/queues/processors/import-processor";

// Note: CHUNK_SIZE (5000) and the chunk-loop logic are internal to the
// processor's default export. These tests cover the exported pure functions.

describe("import-processor", () => {
	function makeRecords(count: number): IngestionRecord[] {
		return Array.from({ length: count }, (_, i) => ({
			secopId: `SECOP-${i}`,
			title: `Notice ${i}`,
		}));
	}

	describe("deduplicateRecords", () => {
		it("keeps the last occurrence when duplicate secopIds exist", () => {
			const records: IngestionRecord[] = [
				{ secopId: "SECOP-DUP", title: "First" },
				{ secopId: "SECOP-DUP", title: "Second" },
				{ secopId: "SECOP-UNIQUE", title: "Unique" },
			];

			const result = deduplicateRecords(records);

			expect(result).toHaveLength(2);
			expect(result).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ secopId: "SECOP-DUP", title: "Second" }),
					expect.objectContaining({ secopId: "SECOP-UNIQUE", title: "Unique" }),
				]),
			);
		});

		it("returns same count when no duplicates", () => {
			const records = makeRecords(150);
			const result = deduplicateRecords(records);
			expect(result).toHaveLength(150);
		});

		it("returns empty array for empty input", () => {
			const result = deduplicateRecords([]);
			expect(result).toHaveLength(0);
		});
	});

	describe("toEntityShape", () => {
		it("maps secopId and title", () => {
			const record: IngestionRecord = {
				secopId: "SECOP-001",
				title: "Notice 1",
			};
			const entity = toEntityShape(record);
			expect(entity.secopId).toBe("SECOP-001");
			expect(entity.title).toBe("Notice 1");
		});

		it("uses secopId as title fallback", () => {
			const record: IngestionRecord = { secopId: "SECOP-FALLBACK" };
			const entity = toEntityShape(record);
			expect(entity.title).toBe("SECOP-FALLBACK");
		});

		it("defaults source to SECOP_II", () => {
			const record: IngestionRecord = { secopId: "SECOP-NOSOURCE" };
			const entity = toEntityShape(record);
			expect(entity.source).toBe("SECOP_II");
		});

		it("preserves explicit source", () => {
			const record: IngestionRecord = {
				secopId: "SECOP-SRC",
				source: "SECOP_I",
			};
			const entity = toEntityShape(record);
			expect(entity.source).toBe("SECOP_I");
		});

		it("converts date strings to Date objects", () => {
			const record: IngestionRecord = {
				secopId: "SECOP-DATES",
				publicationDate: "2024-01-15T00:00:00.000Z",
				sourceLastUpdatedAt: "2023-06-01T12:00:00.000Z",
				awardedDate: "2024-03-10T00:00:00.000Z",
			};
			const entity = toEntityShape(record);

			expect(entity.publicationDate).toBeInstanceOf(Date);
			expect(entity.publicationDate!.toISOString()).toBe(
				"2024-01-15T00:00:00.000Z",
			);
			expect(entity.sourceLastUpdatedAt).toBeInstanceOf(Date);
			expect(entity.awardedDate).toBeInstanceOf(Date);
		});

		it("preserves rawData from sourceMetadata", () => {
			const record: IngestionRecord = {
				secopId: "SECOP-RAW",
				sourceMetadata: { upstream: "payload-v1" },
			};
			const entity = toEntityShape(record);

			expect(entity.rawData).toEqual({ upstream: "payload-v1" });
			expect(entity.sourceMetadata).toEqual({ upstream: "payload-v1" });
		});

		it("handles null/undefined dates gracefully", () => {
			const record: IngestionRecord = { secopId: "SECOP-NULLS" };
			const entity = toEntityShape(record);

			expect(entity.publicationDate).toBeNull();
			expect(entity.deadlineDate).toBeNull();
			expect(entity.awardedDate).toBeNull();
			expect(entity.sourceLastUpdatedAt).toBeNull();
		});

		it("maps all optional numeric fields to null when missing", () => {
			const record: IngestionRecord = { secopId: "SECOP-NONUMS" };
			const entity = toEntityShape(record);

			expect(entity.value).toBeNull();
			expect(entity.awardedValue).toBeNull();
		});

		it("enriches fields via enrichRecord on mapping", () => {
			const record: IngestionRecord = {
				secopId: "SECOP-ENRICH",
				department: "Antioquia",
				publicationDate: "2026-05-01",
				deadlineDate: "2026-05-06",
				value: 500000,
				entityNit: "800.197.268-4",
				awardedContractorNit: "901-234 567",
				currency: " cop ",
			};
			const entity = toEntityShape(record);

			expect(entity.latitude).toBeCloseTo(6.25184, 5);
			expect(entity.longitude).toBeCloseTo(-75.56359, 5);
			expect(entity.executionDurationDays).toBe(5);
			expect(entity.valuePerDay).toBe(100000);
			expect(entity.entityNit).toBe("8001972684");
			expect(entity.awardedContractorNit).toBe("901234567");
			expect(entity.currency).toBe("COP");
		});
	});

	describe("IngestionJobResult shape", () => {
		it("matches expected interface", () => {
			const result: IngestionJobResult = {
				created: 5,
				updated: 3,
				failed: 2,
				errors: [{ secopId: "ERR-1", reason: "timeout" }],
			};

			expect(result.created).toBe(5);
			expect(result.errors).toHaveLength(1);
		});
	});
});
