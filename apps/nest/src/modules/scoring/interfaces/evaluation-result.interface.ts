/**
 * Result of checking a company against a procurement notice's hard filters.
 */
export interface EvaluationResult {
  /**
   * Indicates whether the company passed all evaluated hard filters.
   */
  passed: boolean;
  /**
   * The reason code if the company failed the hard filters.
   */
  reason?:
    | 'FINANCIAL_CAPACITY'
    | 'RESIDUAL_CAPACITY'
    | 'UNSPSC_MISMATCH'
    | 'GEOGRAPHIC_MISMATCH'
    | 'MODALITY_EXCLUSION'
    | 'CONTRACT_TYPE_EXCLUSION'
    | 'DEADLINE_EXPIRED';
  /**
   * Detailed explanation or justification for the filter outcome.
   */
  justification: string;
}
