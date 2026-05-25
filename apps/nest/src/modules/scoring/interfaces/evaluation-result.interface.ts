export interface EvaluationResult {
  passed: boolean;
  reason?:
    | 'FINANCIAL_CAPACITY'
    | 'RESIDUAL_CAPACITY'
    | 'UNSPSC_MISMATCH'
    | 'GEOGRAPHIC_MISMATCH'
    | 'MODALITY_EXCLUSION'
    | 'CONTRACT_TYPE_EXCLUSION'
    | 'DEADLINE_EXPIRED';
  justification: string;
}
