/**
 * Detailed results of scoring a company against a procurement notice.
 */
export interface ScoringResult {
  /**
   * Overall matching affinity score, ranging from 0 to 100.
   */
  score: number;

  /**
   * Component vector breakdown of the matching score.
   */
  vectorBreakdown: {
    /**
     * Technical compatibility evaluation.
     */
    technicalFit: {
      /**
       * Score component based on UNSPSC code match level (0-20).
       */
      unspscMatch: number;
      /**
       * Score component based on semantic similarity of company name/sectors to notice description (0-20).
       */
      semanticSimilarity: number;
      /**
       * Total technical fit score (0-40).
       */
      score: number;
    };
    /**
     * Economic capacity and ticket size compatibility evaluation.
     */
    economicFit: {
      /**
       * Score component based on target ticket deviation (0-15).
       */
      ticketDeviation: number;
      /**
       * Score component based on cash flow capacity (0-10).
       */
      cashFlowCapacity: number;
      /**
       * Total economic fit score (0-25).
       */
      score: number;
    };
    /**
     * Past experience compatibility evaluation.
     */
    experienceMatch: {
      /**
       * Score component based on semantic similarity of past contracts' descriptions (0-10).
       */
      semanticSimilarity: number;
      /**
       * Score component based on density of matching UNSPSC codes in past contracts (0-10).
       */
      unspscDensity: number;
      /**
       * Total experience match score (0-20).
       */
      score: number;
    };
    /**
     * Geographical and entity affinity evaluation.
     */
    affinityGeographical: {
      /**
       * Score component based on prior relationship with the contracting entity (0-10).
       */
      clientAffinity: number;
      /**
       * Score component based on geographic presence or past contracts in the region (0-5).
       */
      geographicPresence: number;
      /**
       * Total geographical affinity score (0-15).
       */
      score: number;
    };
  };

  /**
   * Natural language justification for the matching score components.
   */
  justification: string;
}
