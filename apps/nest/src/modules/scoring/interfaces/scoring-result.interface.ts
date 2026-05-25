export interface ScoringResult {
  score: number;
  vectorBreakdown: {
    technicalFit: {
      unspscMatch: number;
      semanticSimilarity: number;
      score: number;
    };
    economicFit: {
      ticketDeviation: number;
      cashFlowCapacity: number;
      score: number;
    };
    experienceMatch: {
      semanticSimilarity: number;
      unspscDensity: number;
      score: number;
    };
    affinityGeographical: {
      clientAffinity: number;
      geographicPresence: number;
      score: number;
    };
  };
  justification: string;
}
