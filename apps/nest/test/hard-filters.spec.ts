import { HardFiltersService } from "../src/modules/scoring/services/hard-filters.service";
import { Company } from "../src/modules/companies/entities/company.entity";
import { ProcurementNotice } from "../src/modules/procurement-notices/entities/procurement-notice.entity";
import { CompanyContract } from "../src/modules/companies/entities/company-contract.entity";

describe("HardFiltersService", () => {
  let service: HardFiltersService;
  
  beforeEach(() => {
    service = new HardFiltersService();
  });

  const createMockCompany = (overrides: Partial<Company> = {}): Company => {
    const company = new Company();
    company.id = "company-1";
    company.nit = "123456789";
    company.name = "Test Company";
    company.sectors = ["432115"]; // Authorized UNSPSC Class
    company.regions = ["25"]; // Cundinamarca
    company.contractingCapacity = 500000000; // 500M COP
    company.targetTicket = 100000000; // 100M COP
    company.workingCapital = 80000000; // 80M COP
    company.annualRevenue = 200000000; // 200M COP
    company.excludedContractTypes = [];
    company.excludedModalities = [];
    company.unspscMatchPolicy = "strict";
    company.createdAt = new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000); // 3 years ago
    return Object.assign(company, overrides);
  };

  const createMockNotice = (overrides: Partial<ProcurementNotice> = {}): ProcurementNotice => {
    const notice = new ProcurementNotice();
    notice.id = "notice-1";
    notice.secopId = "SEC-101";
    notice.source = "SECOP_II";
    notice.title = "Test Notice";
    notice.description = "Test description for contracting";
    notice.value = 150000000; // 150M COP
    notice.contractType = "Servicio";
    notice.unspscCode = "43211502"; // Belongs to Class 432115
    notice.department = "Cundinamarca";
    notice.contractingModality = "Licitación Pública";
    notice.deadlineDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days in future
    return Object.assign(notice, overrides);
  };

  describe("Financial Capacity Filter", () => {
    it("should pass when notice value is below contracting capacity", () => {
      const company = createMockCompany({ contractingCapacity: 200000000 });
      const notice = createMockNotice({ value: 150000000 });
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(true);
    });

    it("should exclude when notice value exceeds contracting capacity", () => {
      const company = createMockCompany({ contractingCapacity: 100000000 });
      const notice = createMockNotice({ value: 150000000 });
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe("FINANCIAL_CAPACITY");
      expect(result.justification).toContain("supera la capacidad máxima de contratación");
    });
  });

  describe("Residual Capacity Filter", () => {
    it("should skip residual capacity check if contract type is not Obra", () => {
      const company = createMockCompany({ workingCapital: 10000000 }); // very low capital
      const notice = createMockNotice({ contractType: "Servicios", value: 100000000 });
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(true);
    });

    it("should pass Obra notice if company K_R is sufficient", () => {
      const company = createMockCompany({ 
        annualRevenue: 500000000, // FCC = 500M
        createdAt: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000)
      });
      const notice = createMockNotice({ contractType: "Obra", value: 300000000 }); // Requires 300M residual capacity
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(true);
    });

    it("should exclude Obra notice if company K_R is insufficient", () => {
      const company = createMockCompany({ 
        annualRevenue: 200000000, // FCC = 200M
        createdAt: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000)
      });
      const notice = createMockNotice({ contractType: "Obra", value: 300000000 }); // Requires 300M residual capacity (exceeds FCC)
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe("RESIDUAL_CAPACITY");
      expect(result.justification).toContain("capacidad residual");
    });

    it("should subtract SCE (active contracts) from available K_R", () => {
      const company = createMockCompany({ 
        annualRevenue: 500000000, // FCC = 500M
        createdAt: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000)
      });
      const notice = createMockNotice({ contractType: "Obra", value: 300000000 }); // Requires 300M

      // Create an active contract in execution
      const activeContract = new CompanyContract();
      activeContract.value = 300000000;
      activeContract.status = "EJECUCION";
      activeContract.startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // started 30 days ago
      activeContract.endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // ends in 30 days (60 days total)
      
      // SCE should be: (300M / 60) * 30 = 150M.
      // Net K_R = 500M - 150M = 350M. 300M <= 350M (Passes)
      const result1 = service.evaluate(company, notice, [activeContract]);
      expect(result1.passed).toBe(true);

      // Now create a larger active contract
      activeContract.value = 600000000;
      // SCE = (600M / 60) * 30 = 300M.
      // Net K_R = 500M - 300M = 200M. 300M > 200M (Excluded)
      const result2 = service.evaluate(company, notice, [activeContract]);
      expect(result2.passed).toBe(false);
      expect(result2.reason).toBe("RESIDUAL_CAPACITY");
    });

    it("should fallback to workingCapital if company has less than 2 years of existence", () => {
      const company = createMockCompany({ 
        annualRevenue: 500000000, 
        workingCapital: 100000000, // FCC should fallback to 100M
        createdAt: new Date(Date.now() - 1 * 365 * 24 * 60 * 60 * 1000) // 1 year old
      });
      const notice = createMockNotice({ contractType: "Obra", value: 150000000 }); // Requires 150M (> 100M, Excluded)
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe("RESIDUAL_CAPACITY");
    });
  });

  describe("UNSPSC Sector Hierarchy Filter", () => {
    it("should pass under strict mode if Class (first 6 digits) matches", () => {
      const company = createMockCompany({ sectors: ["432115"], unspscMatchPolicy: "strict" });
      const notice = createMockNotice({ unspscCode: "43211502" }); // shares first 6 digits
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(true);
    });

    it("should exclude under strict mode if Class matches only at Family level (first 4 digits)", () => {
      const company = createMockCompany({ sectors: ["432115"], unspscMatchPolicy: "strict" });
      const notice = createMockNotice({ unspscCode: "43212001" }); // shares first 4 digits, but not 6
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe("UNSPSC_MISMATCH");
    });

    it("should pass under flexible mode if Family (first 4 digits) matches", () => {
      const company = createMockCompany({ sectors: ["432115"], unspscMatchPolicy: "flexible" });
      const notice = createMockNotice({ unspscCode: "43212001" }); // shares first 4 digits
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(true);
    });

    it("should exclude under flexible mode if even Family level doesn't match", () => {
      const company = createMockCompany({ sectors: ["432115"], unspscMatchPolicy: "flexible" });
      const notice = createMockNotice({ unspscCode: "44120000" }); // completely different
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe("UNSPSC_MISMATCH");
    });
  });

  describe("Geographic Coverage Intersect", () => {
    it("should pass if execution department DIVIPOLA code exists in company regions", () => {
      const company = createMockCompany({ regions: ["25", "05"] }); // Cundinamarca and Antioquia
      const notice = createMockNotice({ department: "Antioquia" }); // Code "05"
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(true);
    });

    it("should exclude if execution department DIVIPOLA code is not in company regions", () => {
      const company = createMockCompany({ regions: ["25"] });
      const notice = createMockNotice({ department: "Antioquia" }); // Code "05"
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe("GEOGRAPHIC_MISMATCH");
    });

    it("should pass if company has no registered regions (national coverage / unrestricted)", () => {
      const company = createMockCompany({ regions: [] });
      const notice = createMockNotice({ department: "Antioquia" });
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(true);
    });
  });

  describe("Excluded Modality and Contract Type Filter", () => {
    it("should exclude if notice contract type is blacklisted by company", () => {
      const company = createMockCompany({ excludedContractTypes: ["Obra", "Suministro"] });
      const notice = createMockNotice({ contractType: "Obra" });
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe("CONTRACT_TYPE_EXCLUSION");
    });

    it("should exclude if notice modality is blacklisted by company", () => {
      const company = createMockCompany({ excludedModalities: ["Contratación Directa"] });
      const notice = createMockNotice({ contractingModality: "Contratación Directa" });
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe("MODALITY_EXCLUSION");
    });
  });

  describe("Active Notice Deadline Validation", () => {
    it("should pass active SECOP II notice if deadline is in the future", () => {
      const company = createMockCompany();
      const notice = createMockNotice({ 
        source: "SECOP_II", 
        deadlineDate: new Date(Date.now() + 10000000) 
      });
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(true);
    });

    it("should exclude active SECOP II notice if deadline is in the past", () => {
      const company = createMockCompany();
      const notice = createMockNotice({ 
        source: "SECOP_II", 
        deadlineDate: new Date(Date.now() - 5000) 
      });
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(false);
      expect(result.reason).toBe("DEADLINE_EXPIRED");
    });

    it("should not exclude SECOP I notice even if deadline/signature is in the past (historical)", () => {
      const company = createMockCompany();
      const notice = createMockNotice({ 
        source: "SECOP_I", 
        deadlineDate: new Date(Date.now() - 5000000) 
      });
      
      const result = service.evaluate(company, notice, []);
      expect(result.passed).toBe(true);
    });
  });
});
