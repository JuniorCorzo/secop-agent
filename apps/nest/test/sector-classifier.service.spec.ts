import { classify, normalizeText } from '@/modules/procurement-notices/services/sector-classifier.service';
import type { SectorScore } from '@/modules/procurement-notices/services/sector-classifier.service';
import type { SectorKeyword } from '@/modules/procurement-notices/entities/sector-keyword.entity';

// ── Fixtures ────────────────────────────────────────────────────────────────

type KeywordFixture = Pick<SectorKeyword, 'sector' | 'keyword' | 'weight'>;

const SALUD_KEYWORDS: KeywordFixture[] = [
  { sector: 'SALUD', keyword: 'medicamento', weight: 1.0 },
  { sector: 'SALUD', keyword: 'quirurgico', weight: 0.8 },
  { sector: 'SALUD', keyword: 'hospital', weight: 0.8 },
];

const TI_KEYWORDS: KeywordFixture[] = [
  { sector: 'TI', keyword: 'software', weight: 1.0 },
  { sector: 'TI', keyword: 'licencia', weight: 0.7 },
];

const SERVICIOS_KEYWORDS: KeywordFixture[] = [
  { sector: 'SERVICIOS', keyword: 'soporte', weight: 0.3 },
  { sector: 'SERVICIOS', keyword: 'consultoria', weight: 0.8 },
];

const ALL_KEYWORDS: KeywordFixture[] = [
  ...SALUD_KEYWORDS,
  ...TI_KEYWORDS,
  ...SERVICIOS_KEYWORDS,
];

// ── normalizeText ────────────────────────────────────────────────────────────

describe('normalizeText', () => {
  it('converts to lowercase', () => {
    expect(normalizeText('SALUD')).toBe('salud');
  });

  it('removes accents', () => {
    expect(normalizeText('quírurgico')).toBe('quirurgico');
    expect(normalizeText('medicación')).toBe('medicacion');
  });

  it('replaces non-alphanumeric chars with spaces', () => {
    expect(normalizeText('soporte técnico')).toBe('soporte tecnico');
    // Non-alphanumeric chars become spaces; consecutive spaces are collapsed to one
    expect(normalizeText('A, B! C?')).toBe('a b c');
  });

  it('normalizes multiple spaces to single space', () => {
    expect(normalizeText('foo   bar')).toBe('foo bar');
  });
});

// ── classify ────────────────────────────────────────────────────────────────

describe('classify', () => {
  describe('single keyword match', () => {
    /**
     * Spec scenario: Clasificación exitosa por coincidencia
     * GIVEN keyword "medicamento" for SALUD with weight 1.0
     * WHEN classifying "Suministro de medicamento hospitalario"
     * THEN sector = "SALUD"
     */
    it('classifies by a single keyword match', () => {
      // Title contains only "medicamento" from SALUD keywords (no "hospital" substring)
      const result = classify('Suministro de medicamento generico', SALUD_KEYWORDS);

      expect(result.sector).toBe('SALUD');
      const saludScore = result.scores.find((s: SectorScore) => s.sector === 'SALUD');
      expect(saludScore?.score).toBeCloseTo(1.0);
    });
  });

  describe('multiple keywords same sector (score accumulation)', () => {
    /**
     * Spec scenario: Coincidencia de múltiples palabras de un mismo sector
     * GIVEN "medicamento" (1.0) and "quirúrgico" (0.8) for SALUD
     * WHEN classifying "Suministro de medicamento y material quirúrgico"
     * THEN score of SALUD is 1.8
     */
    it('accumulates weights from multiple keywords of the same sector', () => {
      const result = classify(
        'Suministro de medicamento y material quirurgico',
        SALUD_KEYWORDS,
      );

      expect(result.sector).toBe('SALUD');
      const saludScore = result.scores.find((s: SectorScore) => s.sector === 'SALUD');
      expect(saludScore?.score).toBeCloseTo(1.8);
    });
  });

  describe('multiple sectors — highest score wins', () => {
    /**
     * Spec scenario: Coincidencia en múltiples sectores (mayor puntuación gana)
     * GIVEN "software" (1.0) for TI and "soporte" (0.3) for SERVICIOS
     * WHEN classifying "Soporte técnico y software de gestión"
     * THEN TI wins (1.0 > 0.3)
     */
    it('selects the sector with the highest accumulated score', () => {
      const result = classify('Soporte tecnico y software de gestion', ALL_KEYWORDS);

      expect(result.sector).toBe('TI');
      const tiScore = result.scores.find((s: SectorScore) => s.sector === 'TI');
      const serviciosScore = result.scores.find((s: SectorScore) => s.sector === 'SERVICIOS');
      expect(tiScore?.score).toBeCloseTo(1.0);
      expect(serviciosScore?.score).toBeCloseTo(0.3);
    });
  });

  describe('fallback to "Otros"', () => {
    /**
     * Spec scenario: Fallback a sector por defecto
     * GIVEN no keywords matching the title
     * WHEN classifying "Servicio de consultoría general no especificado"
     * THEN sector = "Otros"
     */
    it('returns "Otros" when no keywords match (score 0)', () => {
      const result = classify(
        'Servicio de consultoria general no especificado',
        SALUD_KEYWORDS, // none of these match
      );

      expect(result.sector).toBe('Otros');
    });

    it('returns "Otros" when keywords array is empty', () => {
      const result = classify('Compra de medicamentos hospitalarios', []);

      expect(result.sector).toBe('Otros');
      expect(result.scores).toHaveLength(0);
    });
  });

  describe('tie-breaking — alphabetically first sector wins', () => {
    /**
     * Design decision: tie-breaking alphabetically (first sector name wins)
     * GIVEN both ALPHA and ZETA sectors have keywords matching the title with equal weight
     * WHEN classifying a title containing both keywords
     * THEN ALPHA is selected (alphabetically first)
     */
    it('resolves ties by selecting the alphabetically first sector', () => {
      const tiedKeywords: KeywordFixture[] = [
        { sector: 'ZETA', keyword: 'alpha', weight: 1.0 },
        { sector: 'ALPHA', keyword: 'zeta', weight: 1.0 },
      ];
      const result = classify('alpha zeta test', tiedKeywords);

      expect(result.sector).toBe('ALPHA');
    });

    it('resolves ties with multiple sectors correctly', () => {
      const tiedKeywords: KeywordFixture[] = [
        { sector: 'SALUD', keyword: 'test', weight: 0.5 },
        { sector: 'INFRAESTRUCTURA', keyword: 'test', weight: 0.5 },
        { sector: 'ALIMENTOS', keyword: 'test', weight: 0.5 },
      ];
      const result = classify('test de muestra', tiedKeywords);

      // ALIMENTOS comes before INFRAESTRUCTURA and SALUD alphabetically
      expect(result.sector).toBe('ALIMENTOS');
    });
  });

  describe('accent-insensitive matching', () => {
    it('matches keywords that differ from title only by accents', () => {
      // title has "quirúrgico" (with accent), keyword is "quirurgico" (without)
      const result = classify('Material quirúrgico para hospital', SALUD_KEYWORDS);

      const saludScore = result.scores.find((s: SectorScore) => s.sector === 'SALUD');
      // "quirurgico" (0.8) + "hospital" (0.8) = 1.6
      expect(saludScore?.score).toBeCloseTo(1.6);
    });
  });

  describe('scores array ordering', () => {
    it('returns scores sorted by descending score', () => {
      const result = classify('soporte software medicamento', ALL_KEYWORDS);

      const nonZeroScores = result.scores.filter((s: SectorScore) => s.score > 0);
      for (let i = 1; i < nonZeroScores.length; i++) {
        expect(nonZeroScores[i - 1].score).toBeGreaterThanOrEqual(nonZeroScores[i].score);
      }
    });
  });
});
