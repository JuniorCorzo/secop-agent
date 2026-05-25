import type { Job } from "bullmq";
import { ScoringWorker } from "../src/modules/scoring/workers/scoring.worker";
import { ProcurementNotice } from "../src/modules/procurement-notices/entities/procurement-notice.entity";
import { Company } from "../src/modules/companies/entities/company.entity";
import { CompanyContract } from "../src/modules/companies/entities/company-contract.entity";
import type { ScoringPersistenceService } from "../src/modules/scoring/services/scoring-persistence.service";

describe("ScoringWorker", () => {
	let worker: ScoringWorker;
	let noticeRepo: any;
	let companyRepo: any;
	let contractRepo: any;
	let scoringPersistence: any;

	beforeEach(() => {
		noticeRepo = {
			findOne: jest.fn(),
			find: jest.fn(),
			save: jest.fn(),
		};
		companyRepo = {
			findOne: jest.fn(),
			find: jest.fn(),
		};
		contractRepo = {
			find: jest.fn(),
		};

		scoringPersistence = {
			evaluateAndPersist: jest.fn().mockResolvedValue(undefined),
		};

		worker = new ScoringWorker(
			noticeRepo,
			companyRepo,
			contractRepo,
			scoringPersistence as unknown as ScoringPersistenceService,
		);
	});

	describe("process dispatch (strategy map)", () => {
		it('routes "scoring-dispatch" jobs to the dispatch handler', async () => {
			const notice = new ProcurementNotice();
			notice.id = "notice-uuid";
			notice.status = "ENRICHING";

			const company = new Company();
			company.id = "company-1";
			company.name = "Test Co";

			noticeRepo.findOne.mockResolvedValue(notice);
			noticeRepo.save.mockResolvedValue(notice);
			companyRepo.find.mockResolvedValue([company]);
			contractRepo.find.mockResolvedValue([]);

			const job = {
				name: "scoring-dispatch",
				id: "job-1",
				data: {
					procurementNoticeId: "notice-uuid",
					secopId: "secop-id",
					sourceEvent: "NewProcurementNoticeEvent",
				},
			} as Job;

			const result = await worker.process(job);

			expect(result).toEqual({ processed: true, companiesMatched: 1 });
			expect(scoringPersistence.evaluateAndPersist).toHaveBeenCalledWith(
				company,
				notice,
				[],
			);
		});

		it('routes "company-batch-scoring" jobs to the batch handler', async () => {
			const company = new Company();
			company.id = "company-uuid";
			company.name = "Batch Co";

			const notice = new ProcurementNotice();
			notice.id = "notice-1";

			companyRepo.findOne.mockResolvedValue(company);
			contractRepo.find.mockResolvedValue([]);
			noticeRepo.find.mockResolvedValue([notice]);

			const job = {
				name: "company-batch-scoring",
				id: "job-2",
				data: { companyId: "company-uuid", noticeIds: ["notice-1"] },
			} as Job;

			const result = await worker.process(job);

			expect(result).toEqual({ processed: true, noticesMatched: 1 });
			expect(scoringPersistence.evaluateAndPersist).toHaveBeenCalledWith(
				company,
				notice,
				[],
			);
		});

		it("throws for unknown job names", async () => {
			const job = {
				name: "unknown-job-type",
				id: "job-3",
				data: {},
			} as Job;

			await expect(worker.process(job)).rejects.toThrow(
				"Unknown job name: unknown-job-type",
			);
		});
	});

	describe("scoring-dispatch handler", () => {
		it("throws if the notice does not exist", async () => {
			noticeRepo.findOne.mockResolvedValue(null);
			const job = {
				name: "scoring-dispatch",
				id: "job-1",
				data: {
					procurementNoticeId: "notice-uuid",
					secopId: "secop-id",
					sourceEvent: "NewProcurementNoticeEvent",
				},
			} as Job;

			await expect(worker.process(job)).rejects.toThrow(
				"Procurement notice notice-uuid not found",
			);
		});

		it("transitions notice status to SCORING", async () => {
			const notice = new ProcurementNotice();
			notice.id = "notice-uuid";
			notice.status = "ENRICHING";

			noticeRepo.findOne.mockResolvedValue(notice);
			noticeRepo.save.mockResolvedValue(notice);
			companyRepo.find.mockResolvedValue([]);
			contractRepo.find.mockResolvedValue([]);

			const job = {
				name: "scoring-dispatch",
				id: "job-1",
				data: {
					procurementNoticeId: "notice-uuid",
					secopId: "secop-id",
					sourceEvent: "NewProcurementNoticeEvent",
				},
			} as Job;

			await worker.process(job);

			expect(notice.status).toBe("SCORING");
			expect(noticeRepo.save).toHaveBeenCalledWith(notice);
		});

		it("delegates evaluation to ScoringPersistenceService for each company", async () => {
			const notice = new ProcurementNotice();
			notice.id = "notice-uuid";
			notice.status = "ENRICHING";

			const companyA = new Company();
			companyA.id = "company-a";
			const companyB = new Company();
			companyB.id = "company-b";

			const contractForA = new CompanyContract();
			contractForA.id = "ctr-1";
			contractForA.company = companyA;

			noticeRepo.findOne.mockResolvedValue(notice);
			noticeRepo.save.mockResolvedValue(notice);
			companyRepo.find.mockResolvedValue([companyA, companyB]);
			contractRepo.find.mockResolvedValue([contractForA]);

			const job = {
				name: "scoring-dispatch",
				id: "job-1",
				data: {
					procurementNoticeId: "notice-uuid",
					secopId: "secop-id",
					sourceEvent: "NewProcurementNoticeEvent",
				},
			} as Job;

			const result = await worker.process(job);

			expect(result).toEqual({ processed: true, companiesMatched: 2 });
			expect(scoringPersistence.evaluateAndPersist).toHaveBeenCalledTimes(2);
			expect(scoringPersistence.evaluateAndPersist).toHaveBeenCalledWith(
				companyA,
				notice,
				[contractForA],
			);
			expect(scoringPersistence.evaluateAndPersist).toHaveBeenCalledWith(
				companyB,
				notice,
				[],
			);
		});
	});

	describe("company-batch-scoring handler", () => {
		it("throws if the company does not exist", async () => {
			companyRepo.findOne.mockResolvedValue(null);
			const job = {
				name: "company-batch-scoring",
				id: "job-2",
				data: { companyId: "company-uuid", noticeIds: ["notice-uuid-1"] },
			} as Job;

			await expect(worker.process(job)).rejects.toThrow(
				"Company company-uuid not found",
			);
		});

		it("delegates evaluation to ScoringPersistenceService for each notice", async () => {
			const company = new Company();
			company.id = "company-uuid";
			company.name = "Test Company";

			const notice1 = new ProcurementNotice();
			notice1.id = "notice-uuid-1";
			const notice2 = new ProcurementNotice();
			notice2.id = "notice-uuid-2";

			companyRepo.findOne.mockResolvedValue(company);
			contractRepo.find.mockResolvedValue([]);
			noticeRepo.find.mockResolvedValue([notice1, notice2]);

			const job = {
				name: "company-batch-scoring",
				id: "job-2",
				data: {
					companyId: "company-uuid",
					noticeIds: ["notice-uuid-1", "notice-uuid-2"],
				},
			} as Job;

			const result = await worker.process(job);

			expect(result).toEqual({ processed: true, noticesMatched: 2 });
			expect(scoringPersistence.evaluateAndPersist).toHaveBeenCalledTimes(2);
			expect(scoringPersistence.evaluateAndPersist).toHaveBeenCalledWith(
				company,
				notice1,
				[],
			);
			expect(scoringPersistence.evaluateAndPersist).toHaveBeenCalledWith(
				company,
				notice2,
				[],
			);
		});
	});
});
