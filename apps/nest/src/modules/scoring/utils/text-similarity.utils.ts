function removeAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Tokenizes text by lowercasing, removing accents, cleaning non-alphanumeric chars,
 * and filtering out common Spanish stop words.
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
 * Calculates cosine similarity between two texts using a TF-IDF representation
 * based on the two texts as the corpus.
 */
export function cosineSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  
  if (tokens1.length === 0 || tokens2.length === 0) {
    return 0.0;
  }
  
  const vocab = new Set([...tokens1, ...tokens2]);
  
  // Term Frequency
  const tf1: Record<string, number> = {};
  const tf2: Record<string, number> = {};
  for (const t of tokens1) {
    tf1[t] = (tf1[t] || 0) + 1;
  }
  for (const t of tokens2) {
    tf2[t] = (tf2[t] || 0) + 1;
  }
  
  // Document Frequency
  const df: Record<string, number> = {};
  for (const term of vocab) {
    let count = 0;
    if (tf1[term]) count++;
    if (tf2[term]) count++;
    df[term] = count;
  }
  
  // TF-IDF vectors
  const vec1: Record<string, number> = {};
  const vec2: Record<string, number> = {};
  const N = 2;
  
  for (const term of vocab) {
    // Smoothed IDF
    const idf = Math.log((1 + N) / (1 + df[term])) + 1;
    vec1[term] = (tf1[term] || 0) * idf;
    vec2[term] = (tf2[term] || 0) * idf;
  }
  
  // Cosine Similarity calculation
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
  // Round to prevent floating point inaccuracies like 1.0000000000000002
  return Math.min(1.0, Math.max(0.0, similarity));
}
