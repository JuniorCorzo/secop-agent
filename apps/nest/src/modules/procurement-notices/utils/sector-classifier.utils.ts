import { SectorKeyword } from '../entities/sector-keyword.entity';

/** Score for a single sector. */
export interface SectorScore {
  sector: string;
  score: number;
}

/** Full classification result including the winning sector and all sector scores. */
export interface ClassificationResult {
  /** The winning sector, or "Otros" if no keywords matched. */
  sector: string;
  /** All sectors with their accumulated scores, sorted descending. */
  scores: SectorScore[];
}

/**
 * Normalizes a text string for keyword matching:
 * - lowercases
 * - strips accents (NFD decomposition)
 * - replaces non-alphanumeric chars (except spaces) with a space
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pure, stateless Keyword Scoring algorithm.
 *
 * Normalizes `title`, then for each sector sums the weight of every
 * keyword that appears (as a whole-word or phrase) in the normalized title.
 *
 * Tie-breaking: alphabetically first sector wins.
 * Fallback: if the top score is 0, returns "Otros".
 *
 * @param title    - The procurement notice title to classify.
 * @param keywords - Full catalog of `SectorKeyword` rows loaded from the DB.
 * @returns        Classification result with winning sector and all scores.
 */
export function classify(
  title: string,
  keywords: Pick<SectorKeyword, 'sector' | 'keyword' | 'weight'>[],
): ClassificationResult {
  const normalizedTitle = normalizeText(title);

  // Accumulate scores per sector
  const scoreMap = new Map<string, number>();

  for (const entry of keywords) {
    const normalizedKeyword = normalizeText(entry.keyword);
    if (normalizedTitle.includes(normalizedKeyword)) {
      const current = scoreMap.get(entry.sector) ?? 0;
      scoreMap.set(entry.sector, current + Number(entry.weight));
    }
  }

  // Build sorted scores array (descending by score, then alphabetically)
  const scores: SectorScore[] = Array.from(scoreMap.entries())
    .map(([sector, score]) => ({ sector, score }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.sector.localeCompare(b.sector);
    });

  // Determine winner
  const topScore = scores[0]?.score ?? 0;
  const winner =
    topScore > 0
      ? (scores.find((s) => s.score === topScore)?.sector ?? 'Otros')
      : 'Otros';

  return { sector: winner, scores };
}
