import { ScoringPersistenceService } from "../src/modules/scoring/services/scoring-persistence.service";
import { HardFiltersService } from "../src/modules/scoring/services/hard-filters.service";
import { ScoringEngineService } from "../src/modules/scoring/services/scoring-engine.service";
import { ProcurementNotice } from "../src/modules/procurement-notices/entities/procurement-notice.entity";
import { Company } from "../src/modules/companies/entities/company.entity";
import { CompanyContract } from "../src/modules/companies/entities/company-contract.entity";

describe("ScoringPersistenceService", () => {
	let service: ScoringPersistenceService;
	let matchingResultRepo: any;
	let scoreLogRepo: any;
	let hardFiltersService: HardFiltersService;
	let scoringEngineService: ScoringEngineService;
	let llmProvider: any;

	beforeEach(() => {
		matchingResultRepo = {
			findOne: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
		};
		scoreLogRepo = {
			create: jest.fn(),
			save: jest.fn(),
		};
		llmProvider = {
			chat: jest.fn(),
			embed: jest.fn(),
			health: jest.fn(),
		};

		hardFiltersService = new HardFiltersService();
		scoringEngineService = new ScoringEngineService();

		service = new ScoringPersistenceService(
			matchingResultRepo,
			scoreLogRepo,
			hardFiltersService,
			scoringEngineService,
			llmProvider,
		);
	});

	describe("evaluateAndPersist", () => {
		it("upserts MatchingResult and appends ScoreLog with EXCLUDED status when hard filters fail", async () => {
			const company = new Company();
			company.id = "company-excluded";
			company.nit = "900000001";
			company.name = "Excluded Co";
			company.sectors = [];
			company.regions = [];
			company.contractingCapacity = 0;

			const notice = new ProcurementNotice();
			notice.id = "notice-uuid";
			notice.unspscCode = "43211502";
			notice.value = 100000;
			notice.department = "Cundinamarca";

			matchingResultRepo.findOne.mockResolvedValue(null);
			matchingResultRepo.create.mockImplementation((dto: any) => dto);
			matchingResultRepo.save.mockResolvedValue({ id: "res-id" });
			scoreLogRepo.create.mockImplementation((dto: any) => dto);
			scoreLogRepo.save.mockResolvedValue({ id: "log-id" });

			await service.evaluateAndPersist(company, notice, []);

			// MatchingResult
			const savedMatch = matchingResultRepo.save.mock.calls[0][0];
			expect(savedMatch.status).toBe("EXCLUDED");
			expect(savedMatch.score).toBe(0);
			expect(savedMatch.vectorBreakdown).toEqual({});

			// ScoreLog
			const savedLog = scoreLogRepo.save.mock.calls[0][0];
			expect(savedLog.totalScore).toBe(0);
			expect(savedLog.category).toBe("EXCLUIDO");
			expect(savedLog.explanation).toBeDefined();
			expect(savedLog.filterResult.passed).toBe(false);

			// LLM should NOT be called for EXCLUDED
			expect(llmProvider.chat).not.toHaveBeenCalled();
		});

		it("persists PASSED status with score > 0, computes category from score, and requests LLM explanation", async () => {
			// This fixture yields a score between 40-69 (REVISAR).
			// Class-level UNSPSC match (20 pts) + economic fit (14+5=19) + geographic presence (5) ≈ 44.
			const company = new Company();
			company.id = "company-revisar";
			company.nit = "900000002";
			company.name = "Revisar Co";
			company.sectors = ["432115"];
			company.regions = ["25"];
			company.contractingCapacity = 200000;
			company.targetTicket = 120000;
			company.workingCapital = 150000;

			const notice = new ProcurementNotice();
			notice.id = "notice-uuid";
			notice.unspscCode = "43211502";
			notice.value = 100000;
			notice.department = "Cundinamarca";

			matchingResultRepo.findOne.mockResolvedValue(null);
			matchingResultRepo.create.mockImplementation((dto: any) => dto);
			matchingResultRepo.save.mockResolvedValue({ id: "res-id" });
			scoreLogRepo.create.mockImplementation((dto: any) => dto);
			scoreLogRepo.save.mockResolvedValue({ id: "log-id" });

			llmProvider.chat.mockResolvedValue({
				content: "LLM narrative explanation",
			});

			await service.evaluateAndPersist(company, notice, []);

			// MatchingResult
			const savedMatch = matchingResultRepo.save.mock.calls[0][0];
			expect(savedMatch.status).toBe("PASSED");
			expect(savedMatch.score).toBeGreaterThan(0);
			expect(savedMatch.justification).toBeDefined();

			// ScoreLog
			const savedLog = scoreLogRepo.save.mock.calls[0][0];
			expect(savedLog.totalScore).toBe(savedMatch.score);
			expect(savedLog.category).toBe("REVISAR");
			expect(savedLog.explanation).toBe("LLM narrative explanation");
			expect(llmProvider.chat).toHaveBeenCalled();
		});

		it("categorizes as VIABLE when score >= 70", async () => {
			// Fixture yielding ≥70: class UNSPSC match (20) + perfect economic fit (15+10=25)
			// + matching liquidated contracts for experience (10 unspscDensity) + geographic (5) + entityNit affinity (10) = 70.
			const company = new Company();
			company.id = "company-viable";
			company.nit = "900000001";
			company.name = "Viable Co";
			company.sectors = ["432115"];
			company.regions = ["25"];
			company.contractingCapacity = 500000;
			company.targetTicket = 100000;
			company.workingCapital = 300000;

			const notice = new ProcurementNotice();
			notice.id = "notice-uuid";
			notice.unspscCode = "43211502";
			notice.value = 100000;
			notice.department = "Cundinamarca";
			notice.entityNit = "900-123-456";

			// 5 matching liquidated contracts: each gives 2 unspscDensity pts (capped at 10)
			const matchingContracts = Array.from({ length: 5 }, (_, i) => {
				const c = new CompanyContract();
				c.id = `ctr-${i}`;
				c.status = "LIQUIDADO";
				c.unspscCode = "43211502";
				c.clientNit = "900-123-456"; // matches notice.entityNit for clientAffinity
				return c;
			});

			matchingResultRepo.findOne.mockResolvedValue(null);
			matchingResultRepo.create.mockImplementation((dto: any) => dto);
			matchingResultRepo.save.mockResolvedValue({ id: "res-id" });
			scoreLogRepo.create.mockImplementation((dto: any) => dto);
			scoreLogRepo.save.mockResolvedValue({ id: "log-id" });

			llmProvider.chat.mockResolvedValue({ content: "LLM viable narrative" });

			await service.evaluateAndPersist(company, notice, matchingContracts);

			const savedMatch = matchingResultRepo.save.mock.calls[0][0];
			const savedLog = scoreLogRepo.save.mock.calls[0][0];
			expect(savedMatch.status).toBe("PASSED");
			expect(savedMatch.score).toBeGreaterThanOrEqual(70);
			expect(savedLog.category).toBe("VIABLE");
		});

		it("falls back to rule-based justification when LLM fails", async () => {
			const company = new Company();
			company.id = "company-fallback";
			company.nit = "900000003";
			company.name = "Fallback Co";
			company.sectors = ["432115"];
			company.regions = ["25"];
			company.contractingCapacity = 500000;

			const notice = new ProcurementNotice();
			notice.id = "notice-uuid";
			notice.unspscCode = "43211502";
			notice.value = 100000;
			notice.department = "Cundinamarca";

			matchingResultRepo.findOne.mockResolvedValue(null);
			matchingResultRepo.create.mockImplementation((dto: any) => dto);
			matchingResultRepo.save.mockResolvedValue({ id: "res-id" });
			scoreLogRepo.create.mockImplementation((dto: any) => dto);
			scoreLogRepo.save.mockResolvedValue({ id: "log-id" });

			llmProvider.chat.mockRejectedValue(new Error("LLM down"));

			await service.evaluateAndPersist(company, notice, []);

			const savedLog = scoreLogRepo.save.mock.calls[0][0];
			expect(savedLog.explanation).toContain("Puntaje total de afinidad");
			expect(llmProvider.chat).toHaveBeenCalled(); // LLM was attempted
		});

		it("upserts an existing MatchingResult instead of creating a new one", async () => {
			const existingResult = {
				id: "existing-res-id",
				status: "PASSED",
				score: 50,
			};
			const company = new Company();
			company.id = "company-existing";
			company.nit = "900000004";
			company.name = "Existing Co";
			company.sectors = ["432115"];
			company.regions = ["25"];
			company.contractingCapacity = 500000;

			const notice = new ProcurementNotice();
			notice.id = "notice-uuid";
			notice.unspscCode = "43211502";
			notice.value = 100000;
			notice.department = "Cundinamarca";

			matchingResultRepo.findOne.mockResolvedValue(existingResult);
			matchingResultRepo.save.mockResolvedValue({
				...existingResult,
				score: 65,
			});
			scoreLogRepo.create.mockImplementation((dto: any) => dto);
			scoreLogRepo.save.mockResolvedValue({ id: "log-id" });

			llmProvider.chat.mockResolvedValue({ content: "Updated LLM" });

			await service.evaluateAndPersist(company, notice, []);

			// Should not call create since the result already exists
			expect(matchingResultRepo.create).not.toHaveBeenCalled();
			expect(matchingResultRepo.save).toHaveBeenCalledTimes(1);
			const savedMatch = matchingResultRepo.save.mock.calls[0][0];
			expect(savedMatch).toBe(existingResult);
			expect(savedMatch.score).toBeGreaterThan(0);
		});
	});
});
