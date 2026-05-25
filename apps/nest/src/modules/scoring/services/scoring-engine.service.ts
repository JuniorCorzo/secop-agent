import { Injectable } from '@nestjs/common';
import { Company } from '../../companies/entities/company.entity';
import { ProcurementNotice } from '../../procurement-notices/entities/procurement-notice.entity';
import { CompanyContract } from '../../companies/entities/company-contract.entity';
import { cosineSimilarity } from '../utils/text-similarity.utils';
import { getDepartmentCode } from '../utils/divipola.utils';

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

@Injectable()
export class ScoringEngineService {
  /**
   * Computes matching score (0-100) between a company and a notice.
   */
  computeScore(
    company: Company,
    notice: ProcurementNotice,
    contracts: CompanyContract[],
  ): ScoringResult {
    // ----------------------------------------------------
    // 1. Technical Fit (0-40 points)
    // ----------------------------------------------------
    let unspscMatch = 0;
    if (notice.unspscCode && company.sectors && company.sectors.length > 0) {
      const code6 = notice.unspscCode.substring(0, 6);
      const code4 = notice.unspscCode.substring(0, 4);
      const code2 = notice.unspscCode.substring(0, 2);

      const hasClassMatch = company.sectors.some((s) => s.substring(0, 6) === code6);
      const hasFamilyMatch = company.sectors.some((s) => s.substring(0, 4) === code4);
      const hasSegmentMatch = company.sectors.some((s) => s.substring(0, 2) === code2);

      if (hasClassMatch) {
        unspscMatch = 20;
      } else if (hasFamilyMatch) {
        unspscMatch = 15;
      } else if (hasSegmentMatch) {
        unspscMatch = 10;
      }
    }

    const techSim = notice.description
      ? cosineSimilarity(notice.description, company.name)
      : 0.0;
    const techSemantic = Number((techSim * 20).toFixed(2));
    const technicalFitScore = Number((unspscMatch + techSemantic).toFixed(2));

    // ----------------------------------------------------
    // 2. Economic Fit (0-25 points)
    // ----------------------------------------------------
    let ticketDeviationScore = 0;
    const noticeValue = Number(notice.value || 0);
    const targetTicket = Number(company.targetTicket || 0);

    if (targetTicket > 0 && noticeValue > 0) {
      const deviation = Math.abs(noticeValue - targetTicket) / targetTicket;
      if (deviation <= 0.15) {
        ticketDeviationScore = 15;
      } else if (deviation <= 0.50) {
        ticketDeviationScore = 15 * Math.exp(-3 * (deviation - 0.15));
      } else {
        ticketDeviationScore = 0;
      }
    }
    ticketDeviationScore = Number(ticketDeviationScore.toFixed(2));

    let cashFlowCapacityScore = 0;
    // Normalize duration to months (assuming 30 days per month)
    const durationDays = Number(notice.executionDurationDays || 30);
    const durationMonths = Math.max(1, durationDays / 30);
    const monthlyFlow = noticeValue / durationMonths;
    const workingCapital = Number(company.workingCapital || 0);

    if (workingCapital >= 3 * monthlyFlow) {
      cashFlowCapacityScore = 10;
    } else if (workingCapital >= 1.5 * monthlyFlow) {
      cashFlowCapacityScore = 5;
    } else {
      cashFlowCapacityScore = 0;
    }
    const economicFitScore = Number((ticketDeviationScore + cashFlowCapacityScore).toFixed(2));

    // ----------------------------------------------------
    // 3. Experience Match (0-20 points)
    // ----------------------------------------------------
    const liquidContracts = contracts.filter((c) => c.status?.toUpperCase() === 'LIQUIDADO');
    
    let maxContractSim = 0.0;
    if (notice.description) {
      for (const contract of liquidContracts) {
        if (contract.description) {
          const sim = cosineSimilarity(notice.description, contract.description);
          if (sim > maxContractSim) {
            maxContractSim = sim;
          }
        }
      }
    }
    const expSemantic = Number((maxContractSim * 10).toFixed(2));

    let matchingUnspscCount = 0;
    if (notice.unspscCode) {
      const code6 = notice.unspscCode.substring(0, 6);
      matchingUnspscCount = liquidContracts.filter(
        (c) => c.unspscCode && c.unspscCode.substring(0, 6) === code6,
      ).length;
    }
    const unspscDensity = Math.min(10, matchingUnspscCount * 2);
    const experienceMatchScore = Number((expSemantic + unspscDensity).toFixed(2));

    // ----------------------------------------------------
    // 4. Affinity & Geographical Match (0-15 points)
    // ----------------------------------------------------
    let clientAffinity = 0;
    if (notice.entityNit) {
      const cleanedEntityNit = notice.entityNit.replace(/[^a-zA-Z0-9]/g, '');
      const hasPriorRelation = liquidContracts.some((c) => {
        if (!c.clientNit) return false;
        const cleanedClientNit = c.clientNit.replace(/[^a-zA-Z0-9]/g, '');
        return cleanedClientNit === cleanedEntityNit;
      });
      if (hasPriorRelation) {
        clientAffinity = 10;
      }
    }

    let geographicPresence = 0;
    const deptCode = getDepartmentCode(notice.department);
    if (deptCode) {
      const isRegisteredRegion = company.regions && company.regions.includes(deptCode);
      const pastContractsInDept = liquidContracts.filter((c) => {
        // Assume presence if there are 3+ contracts executed in that same department (using matching regions logic/mock)
        // Here we can also assume geographic presence if it matches the registered regions or past experience
        return false;
      }).length;

      if (isRegisteredRegion || pastContractsInDept >= 3) {
        geographicPresence = 5;
      }
    }
    const affinityGeographicalScore = Number((clientAffinity + geographicPresence).toFixed(2));

    // Total Score
    const totalScore = Number(
      (
        technicalFitScore +
        economicFitScore +
        experienceMatchScore +
        affinityGeographicalScore
      ).toFixed(2),
    );

    // Natural Language Justification
    const justification = `Puntaje total de afinidad: ${totalScore}/100. Desglose: Technical Fit de ${technicalFitScore}/40 (cruce UNSPSC: ${unspscMatch}, similitud semántica: ${techSemantic}), Economic Fit de ${economicFitScore}/25 (desviación de presupuesto: ${ticketDeviationScore}, flujo de caja mensual: ${cashFlowCapacityScore}), Experience Match de ${experienceMatchScore}/20 (densidad sectorial: ${unspscDensity}, similitud semántica de experiencia: ${expSemantic}), y afinidad geográfica/entidad de ${affinityGeographicalScore}/15.`;

    return {
      score: totalScore,
      vectorBreakdown: {
        technicalFit: {
          unspscMatch,
          semanticSimilarity: techSemantic,
          score: technicalFitScore,
        },
        economicFit: {
          ticketDeviation: ticketDeviationScore,
          cashFlowCapacity: cashFlowCapacityScore,
          score: economicFitScore,
        },
        experienceMatch: {
          semanticSimilarity: expSemantic,
          unspscDensity,
          score: experienceMatchScore,
        },
        affinityGeographical: {
          clientAffinity,
          geographicPresence,
          score: affinityGeographicalScore,
        },
      },
      justification,
    };
  }
}
