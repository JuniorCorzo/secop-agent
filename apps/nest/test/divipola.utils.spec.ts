import { getDepartmentCode } from "../src/modules/scoring/utils/divipola.utils";

describe("divipola.utils", () => {
  describe("getDepartmentCode", () => {
    it("should resolve DIVIPOLA codes for Colombian departments case/accent insensitively", () => {
      expect(getDepartmentCode("Cundinamarca")).toBe("25");
      expect(getDepartmentCode("cundinamarca")).toBe("25");
      expect(getDepartmentCode("CUNDINAMARCA")).toBe("25");
      expect(getDepartmentCode("Antioquia")).toBe("05");
      expect(getDepartmentCode("antioquia")).toBe("05");
      
      // Bogotá variations
      expect(getDepartmentCode("Bogotá D.C.")).toBe("11");
      expect(getDepartmentCode("bogota")).toBe("11");
      expect(getDepartmentCode("DISTRITO CAPITAL")).toBe("11");
    });

    it("should resolve other departments correctly", () => {
      expect(getDepartmentCode("Valle del Cauca")).toBe("76");
      expect(getDepartmentCode("Atlántico")).toBe("08");
      expect(getDepartmentCode("Santander")).toBe("68");
      expect(getDepartmentCode("Bolívar")).toBe("13");
    });

    it("should return null for unrecognized departments or empty inputs", () => {
      expect(getDepartmentCode("Atlantis")).toBeNull();
      expect(getDepartmentCode("")).toBeNull();
      expect(getDepartmentCode(null)).toBeNull();
      expect(getDepartmentCode(undefined)).toBeNull();
    });
  });
});
