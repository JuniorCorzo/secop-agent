import {
  cleanNit,
  geocodeDepartment,
  calculateMetrics,
  enrichRecord,
} from "../src/modules/procurement-notices/utils/enrichment.utils";

describe("enrichment.utils", () => {
  describe("cleanNit", () => {
    it("should remove dots, dashes, and spaces from NIT", () => {
      expect(cleanNit("800.197.268-4")).toBe("8001972684");
      expect(cleanNit("901-234 567")).toBe("901234567");
      expect(cleanNit("  123-456.789  ")).toBe("123456789");
    });

    it("should return null for empty or invalid input", () => {
      expect(cleanNit("")).toBeNull();
      expect(cleanNit(null)).toBeNull();
      expect(cleanNit(undefined)).toBeNull();
      expect(cleanNit("   --- ...   ")).toBeNull();
    });
  });

  describe("geocodeDepartment", () => {
    it("should resolve coordinates for known Colombian departments case-insensitively and accent-insensitively", () => {
      const cundinamarca = geocodeDepartment("Cundinamarca");
      expect(cundinamarca.latitude).toBeCloseTo(4.711, 3);
      expect(cundinamarca.longitude).toBeCloseTo(-74.0721, 3);

      const bogota = geocodeDepartment("bogotá d.c.");
      expect(bogota.latitude).toBeCloseTo(4.711, 3);
      expect(bogota.longitude).toBeCloseTo(-74.0721, 3);

      const antioquia = geocodeDepartment("ANTIOQUIA");
      expect(antioquia.latitude).toBeCloseTo(6.25184, 5);
      expect(antioquia.longitude).toBeCloseTo(-75.56359, 5);
    });

    it("should return null coordinates for unrecognized or empty departments", () => {
      expect(geocodeDepartment("Atlantis")).toEqual({ latitude: null, longitude: null });
      expect(geocodeDepartment("")).toEqual({ latitude: null, longitude: null });
      expect(geocodeDepartment(null)).toEqual({ latitude: null, longitude: null });
      expect(geocodeDepartment(undefined)).toEqual({ latitude: null, longitude: null });
    });
  });

  describe("calculateMetrics", () => {
    it("should compute execution duration in days and value per day", () => {
      const pubDate = "2026-05-01T00:00:00.000Z";
      const deadlineDate = "2026-05-11T00:00:00.000Z"; // 10 days later
      const value = 1000000;

      const metrics = calculateMetrics(pubDate, deadlineDate, value);
      expect(metrics.executionDurationDays).toBe(10);
      expect(metrics.valuePerDay).toBe(100000);
    });

    it("should handle string numbers for value and Date objects for dates", () => {
      const pubDate = new Date("2026-05-01");
      const deadlineDate = new Date("2026-05-03"); // 2 days later
      const value = "5000";

      const metrics = calculateMetrics(pubDate, deadlineDate, value);
      expect(metrics.executionDurationDays).toBe(2);
      expect(metrics.valuePerDay).toBe(2500);
    });

    it("should return nulls if any date is missing or invalid", () => {
      expect(calculateMetrics(null, "2026-05-01", 1000)).toEqual({
        executionDurationDays: null,
        valuePerDay: null,
      });
      expect(calculateMetrics("invalid-date", "2026-05-01", 1000)).toEqual({
        executionDurationDays: null,
        valuePerDay: null,
      });
    });

    it("should return null valuePerDay if value is missing, negative, or invalid", () => {
      const metrics1 = calculateMetrics("2026-05-01", "2026-05-06", null);
      expect(metrics1.executionDurationDays).toBe(5);
      expect(metrics1.valuePerDay).toBeNull();

      const metrics2 = calculateMetrics("2026-05-01", "2026-05-06", -100);
      expect(metrics2.executionDurationDays).toBe(5);
      expect(metrics2.valuePerDay).toBeNull();
    });

    it("should return nulls if deadline date is before publication date", () => {
      const metrics = calculateMetrics("2026-05-10", "2026-05-01", 1000);
      expect(metrics.executionDurationDays).toBeNull();
      expect(metrics.valuePerDay).toBeNull();
    });

    it("should return duration 0 and null valuePerDay if publication and deadline are the same", () => {
      const metrics = calculateMetrics("2026-05-01", "2026-05-01", 1000);
      expect(metrics.executionDurationDays).toBe(0);
      expect(metrics.valuePerDay).toBeNull();
    });
  });

  describe("enrichRecord", () => {
    it("should enrich all record fields successfully", () => {
      const record = {
        department: "Valle del Cauca",
        publicationDate: "2026-05-01",
        deadlineDate: "2026-05-05",
        value: 400000,
        entityNit: "123.456-7",
        awardedContractorNit: "987 654 321",
        currency: "cop ",
      };

      const enriched = enrichRecord(record);
      expect(enriched.latitude).toBeCloseTo(3.43722, 5);
      expect(enriched.longitude).toBeCloseTo(-76.5225, 5);
      expect(enriched.executionDurationDays).toBe(4);
      expect(enriched.valuePerDay).toBe(100000);
      expect(enriched.entityNit).toBe("1234567");
      expect(enriched.awardedContractorNit).toBe("987654321");
      expect(enriched.currency).toBe("COP");
    });
  });
});
