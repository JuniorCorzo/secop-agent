import { ScoringEngineService } from "../src/modules/scoring/services/scoring-engine.service";
import { Company } from "../src/modules/companies/entities/company.entity";
import { ProcurementNotice } from "../src/modules/procurement-notices/entities/procurement-notice.entity";
import { CompanyContract } from "../src/modules/companies/entities/company-contract.entity";

describe("ScoringEngineService", () => {
  let service: ScoringEngineService;

  beforeEach(() => {
    service = new ScoringEngineService();
  });

  const createMockCompany = (overrides: Partial<Company> = {}): Company => {
    const company = new Company();
    company.id = "company-1";
    company.nit = "123456789";
    company.name = "Construcciones Alfa";
    company.sectors = ["432115"]; // Authorized UNSPSC Class
    company.regions = ["25"]; // Cundinamarca
    company.contractingCapacity = 1000000000;
    company.targetTicket = 200000000; // 200M COP target
    company.workingCapital = 150000000; // 150M WK
    company.annualRevenue = 600000000;
    company.createdAt = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000);
    return Object.assign(company, overrides);
  };

  const createMockNotice = (overrides: Partial<ProcurementNotice> = {}): ProcurementNotice => {
    const notice = new ProcurementNotice();
    notice.id = "notice-1";
    notice.secopId = "SEC-102";
    notice.source = "SECOP_II";
    notice.title = "Suministro e instalación de servidores";
    notice.description = "Suministro e instalación de servidores y equipos de cómputo para la red";
    notice.value = 200000000; // 200M (exactly target ticket)
    notice.contractType = "Suministro";
    notice.unspscCode = "43211502"; // Class match
    notice.department = "Cundinamarca"; // DIVIPOLA 25
    notice.entityNit = "900999888";
    notice.executionDurationDays = 152; // 5 months
    return Object.assign(notice, overrides);
  };

  describe("Technical Fit Vector", () => {
    it("should compute maximum technical fit with Class match and identical descriptions", () => {
      const company = createMockCompany();
      const notice = createMockNotice({
        description: "Construcciones Alfa" // same as company name
      });
      const result = service.computeScore(company, notice, []);
      
      expect(result.vectorBreakdown.technicalFit.unspscMatch).toBe(20);
      expect(result.vectorBreakdown.technicalFit.semanticSimilarity).toBeCloseTo(20, 1);
      expect(result.vectorBreakdown.technicalFit.score).toBeCloseTo(40, 1);
    });

    it("should compute lower technical fit for family match and partial description similarity", () => {
      const company = createMockCompany({ sectors: ["432115"] });
      // Family level match: first 4 digits match (4321)
      const notice = createMockNotice({
        unspscCode: "43212010",
        description: "Suministro e instalación de equipos" // partially similar to company name
      });
      const result = service.computeScore(company, notice, []);
      
      expect(result.vectorBreakdown.technicalFit.unspscMatch).toBe(15);
      expect(result.vectorBreakdown.technicalFit.score).toBeLessThan(40);
    });

    it("should compute segment match correctly", () => {
      const company = createMockCompany({ sectors: ["432115"] });
      // Segment level match: first 2 digits match (43)
      const notice = createMockNotice({
        unspscCode: "43100000"
      });
      const result = service.computeScore(company, notice, []);
      expect(result.vectorBreakdown.technicalFit.unspscMatch).toBe(10);
    });
  });

  describe("Economic Fit Vector", () => {
    it("should compute maximum economic fit when deviation is within 15% and cash flow is high", () => {
      const company = createMockCompany({
        targetTicket: 200000000,
        workingCapital: 150000000 // WK = 150M
      });
      const notice = createMockNotice({
        value: 200000000, // 0% deviation -> 15 points
        executionDurationDays: 152 // 5 months -> CF = 200M / 5 = 40M. WK (150M) >= 3 * CF (120M) -> 10 points
      });
      const result = service.computeScore(company, notice, []);
      
      expect(result.vectorBreakdown.economicFit.ticketDeviation).toBe(15);
      expect(result.vectorBreakdown.economicFit.cashFlowCapacity).toBe(10);
      expect(result.vectorBreakdown.economicFit.score).toBe(25);
    });

    it("should apply exponential decay for ticket deviation between 15% and 50%", () => {
      const company = createMockCompany({ targetTicket: 100000000 });
      const notice = createMockNotice({ value: 130000000 }); // 30% deviation (D_margen = 0.3)
      
      const result = service.computeScore(company, notice, []);
      // 15 * exp(-3 * (0.3 - 0.15)) = 15 * exp(-0.45) = 15 * 0.6376 = 9.56
      expect(result.vectorBreakdown.economicFit.ticketDeviation).toBeCloseTo(9.56, 1);
    });

    it("should award 0 points for ticket deviation > 50%", () => {
      const company = createMockCompany({ targetTicket: 100000000 });
      const notice = createMockNotice({ value: 160000000 }); // 60% deviation
      
      const result = service.computeScore(company, notice, []);
      expect(result.vectorBreakdown.economicFit.ticketDeviation).toBe(0);
    });

    it("should scale cash flow capacity score based on working capital coverage", () => {
      const company = createMockCompany({ workingCapital: 80000000 }); // WK = 80M
      const notice = createMockNotice({
        value: 200000000,
        executionDurationDays: 152 // 5 months -> CF = 40M. 1.5 * CF (60M) <= WK (80M) < 3 * CF (120M) -> 5 points
      });
      const result = service.computeScore(company, notice, []);
      expect(result.vectorBreakdown.economicFit.cashFlowCapacity).toBe(5);
    });
  });

  describe("Experience Match Vector", () => {
    it("should calculate experience score using density and semantic similarity of past completed contracts", () => {
      const company = createMockCompany();
      const notice = createMockNotice({
        unspscCode: "43211502",
        description: "Construcción de alcantarillado pluvial"
      });

      const contract1 = new CompanyContract();
      contract1.unspscCode = "43211501"; // Class match
      contract1.status = "LIQUIDADO";
      contract1.description = "Construcción de alcantarillado pluvial"; // Identical description

      const contract2 = new CompanyContract();
      contract2.unspscCode = "43211503"; // Class match
      contract2.status = "LIQUIDADO";
      contract2.description = "Limpieza de alcantarillado"; // Different description

      // 2 contracts with class match -> density score = 2 * 2 = 4
      // Max semantic similarity is 1.0 -> semantic score = 10
      const result = service.computeScore(company, notice, [contract1, contract2]);
      
      expect(result.vectorBreakdown.experienceMatch.unspscDensity).toBe(4);
      expect(result.vectorBreakdown.experienceMatch.semanticSimilarity).toBeCloseTo(10, 1);
      expect(result.vectorBreakdown.experienceMatch.score).toBeCloseTo(14, 1);
    });
  });

  describe("Affinity and Geographical Vector", () => {
    it("should award client affinity if NIT matches historical client NIT", () => {
      const company = createMockCompany();
      const notice = createMockNotice({ entityNit: "900111222" });

      const contract = new CompanyContract();
      contract.clientNit = "900111222";
      contract.status = "LIQUIDADO";
      contract.unspscCode = "43211502";
      contract.value = 100000;

      const result = service.computeScore(company, notice, [contract]);
      expect(result.vectorBreakdown.affinityGeographical.clientAffinity).toBe(10);
    });

    it("should award geographical presence if region matches or company has 3 past contracts in that department", () => {
      const company = createMockCompany({ regions: ["25"] }); // Cundinamarca
      const notice = createMockNotice({ department: "Cundinamarca" }); // Code "25"
      
      const result = service.computeScore(company, notice, []);
      expect(result.vectorBreakdown.affinityGeographical.geographicPresence).toBe(5);
    });
  });
});
