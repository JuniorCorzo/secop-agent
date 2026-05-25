/**
 * Removes accents and diacritics from a string.
 *
 * @param text - The input string to clean.
 * @returns The string with accents removed.
 */
function removeAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Tokenizes text by lowercasing, removing accents, cleaning non-alphanumeric chars,
 * and filtering out common Spanish stop words.
 *
 * @param text - The input text to tokenize.
 * @returns An array of cleaned token strings.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  const normalized = removeAccents(String(text).toLowerCase());
  
  // Replace non-alphanumeric characters with spaces
  const cleaned = normalized.replace(/[^a-z0-9ñáéíóúü\s]/g, " ");
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  
  const stopWords = new Set([
    'de', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'no', 'una', 'su', 'al', 'lo', 'como', 'mas', 'pero', 'sus', 'este', 'esta', 'estos', 'estas', 'o', 'u', 'e', 'si'
  ]);
  
  return tokens.filter(t => !stopWords.has(t));
}

/**
 * Calculates the Term Frequency (TF) for a collection of tokens.
 *
 * @param tokens - An array of tokens.
 * @returns A record containing the frequency count of each unique token.
 */
export function calculateTermFrequency(tokens: string[]): Record<string, number> {
  const tf: Record<string, number> = {};
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  return tf;
}

/**
 * Calculates the Document Frequency (DF) for each term in the vocabulary across
 * two sets of term frequencies.
 *
 * @param vocab - The combined set of unique tokens from both documents.
 * @param tf1 - The term frequencies for the first document.
 * @param tf2 - The term frequencies for the second document.
 * @returns A record containing the document frequency count for each term in the vocabulary.
 */
export function calculateDocumentFrequency(
  vocab: Set<string>,
  tf1: Record<string, number>,
  tf2: Record<string, number>,
): Record<string, number> {
  const df: Record<string, number> = {};
  for (const term of vocab) {
    let count = 0;
    if (tf1[term]) count++;
    if (tf2[term]) count++;
    df[term] = count;
  }
  return df;
}

/**
 * Calculates the TF-IDF vectors for two documents based on a smoothed Inverse Document Frequency (IDF) formula.
 *
 * @param vocab - The combined set of unique tokens.
 * @param tf1 - Term frequencies for the first document.
 * @param tf2 - Term frequencies for the second document.
 * @param df - Document frequencies for each term in the vocabulary.
 * @returns An object containing the TF-IDF vector records for both documents.
 */
export function calculateTfIdfVectors(
  vocab: Set<string>,
  tf1: Record<string, number>,
  tf2: Record<string, number>,
  df: Record<string, number>,
): { vec1: Record<string, number>; vec2: Record<string, number> } {
  const vec1: Record<string, number> = {};
  const vec2: Record<string, number> = {};
  const N = 2; // Fixed number of documents (the two texts being compared)

  for (const term of vocab) {
    // Smoothed IDF calculation: idf = log((1 + N) / (1 + df[term])) + 1
    const idf = Math.log((1 + N) / (1 + df[term])) + 1;
    vec1[term] = (tf1[term] || 0) * idf;
    vec2[term] = (tf2[term] || 0) * idf;
  }

  return { vec1, vec2 };
}

/**
 * Calculates the cosine similarity between two TF-IDF vectors.
 *
 * @param vocab - The combined set of unique tokens.
 * @param vec1 - The TF-IDF vector of the first document.
 * @param vec2 - The TF-IDF vector of the second document.
 * @returns The similarity score between 0.0 (completely dissimilar) and 1.0 (identical).
 */
export function calculateCosineSimilarityFromVectors(
  vocab: Set<string>,
  vec1: Record<string, number>,
  vec2: Record<string, number>,
): number {
  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (const term of vocab) {
    dotProduct += vec1[term] * vec2[term];
    mag1 += vec1[term] * vec1[term];
    mag2 += vec2[term] * vec2[term];
  }

  if (mag1 === 0 || mag2 === 0) {
    return 0.0;
  }

  const similarity = dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  
  // Clamping to avoid floating point precision edge cases (e.g., values slightly above 1.0)
  return Math.min(1.0, Math.max(0.0, similarity));
}

/**
 * Calculates cosine similarity between two texts using a TF-IDF representation
 * based on the two texts as the corpus.
 *
 * @param text1 - The first text.
 * @param text2 - The second text.
 * @returns The cosine similarity score as a number between 0.0 and 1.0.
 */
export function cosineSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  if (tokens1.length === 0 || tokens2.length === 0) {
    return 0.0;
  }

  const vocab = new Set([...tokens1, ...tokens2]);

  const tf1 = calculateTermFrequency(tokens1);
  const tf2 = calculateTermFrequency(tokens2);

  const df = calculateDocumentFrequency(vocab, tf1, tf2);

  const { vec1, vec2 } = calculateTfIdfVectors(vocab, tf1, tf2, df);

  return calculateCosineSimilarityFromVectors(vocab, vec1, vec2);
}

