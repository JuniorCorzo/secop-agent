import { tokenize, cosineSimilarity } from "../src/modules/scoring/utils/text-similarity.utils";

describe("text-similarity.utils", () => {
  describe("tokenize", () => {
    it("should lowercase, remove punctuation, split by whitespace, and filter out stop words", () => {
      const text = "El contrato de obra pública en Bogotá, Cundinamarca.";
      const tokens = tokenize(text);
      
      // Stop words like: 'el', 'de', 'en' should be removed
      expect(tokens).toContain("contrato");
      expect(tokens).toContain("obra");
      expect(tokens).toContain("publica");
      expect(tokens).toContain("bogota");
      expect(tokens).toContain("cundinamarca");
      expect(tokens).not.toContain("el");
      expect(tokens).not.toContain("de");
      expect(tokens).not.toContain("en");
    });

    it("should handle empty or null/undefined inputs", () => {
      expect(tokenize("")).toEqual([]);
      expect(tokenize(null as any)).toEqual([]);
      expect(tokenize(undefined as any)).toEqual([]);
    });

    it("should strip accents/diacritics", () => {
      expect(tokenize("Bogotá")).toEqual(["bogota"]);
      expect(tokenize("relación")).toEqual(["relacion"]);
    });
  });

  describe("cosineSimilarity", () => {
    it("should return 1.0 for identical texts", () => {
      const text1 = "Construcción de vías y pavimentación de calles en Bogotá";
      const text2 = "Construcción de vías y pavimentación de calles en Bogotá";
      expect(cosineSimilarity(text1, text2)).toBeCloseTo(1.0, 5);
    });

    it("should return 0.0 for completely disjoint texts", () => {
      const text1 = "Servicio de limpieza y aseo de oficinas";
      const text2 = "Suministro de equipos de computación y tecnología";
      expect(cosineSimilarity(text1, text2)).toBe(0.0);
    });

    it("should return a value between 0.0 and 1.0 for partially similar texts", () => {
      const text1 = "Construcción de redes de alcantarillado pluvial";
      const text2 = "Estudios de alcantarillado y diseño de redes de acueducto";
      const sim = cosineSimilarity(text1, text2);
      expect(sim).toBeGreaterThan(0.0);
      expect(sim).toBeLessThan(1.0);
    });

    it("should handle empty/null inputs gracefully by returning 0.0", () => {
      expect(cosineSimilarity("", "Construcción de vías")).toBe(0.0);
      expect(cosineSimilarity(null as any, "Construcción de vías")).toBe(0.0);
      expect(cosineSimilarity("Construcción de vías", undefined as any)).toBe(0.0);
    });
  });
});
