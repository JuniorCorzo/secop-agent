import { Injectable } from '@nestjs/common';
import { Company } from '../../companies/entities/company.entity';
import { ProcurementNotice } from '../../procurement-notices/entities/procurement-notice.entity';
import { CompanyContract } from '../../companies/entities/company-contract.entity';
import { cosineSimilarity } from '../utils/text-similarity.utils';
import { getDepartmentCode } from '../utils/divipola.utils';
import { ScoringResult } from '../interfaces/scoring-result.interface';

export { ScoringResult };

/**
 * Service that computes affinity scores between companies and procurement notices.
 */
@Injectable()
export class ScoringEngineService {
  /**
   * Computes matching score (0-100) between a company and a notice.
   *
   * @param company - The company profile to evaluate.
   * @param notice - The procurement notice to match against.
   * @param contracts - The list of past contracts executed by the company.
   * @returns A ScoringResult containing the total score and breakdown components.
   */
  computeScore(
    company: Company,
    notice: ProcurementNotice,
    contracts: CompanyContract[],
  ): ScoringResult {
    const technicalFit = this.computeTechnicalFit(company, notice);
    const economicFit = this.computeEconomicFit(company, notice);
    const experienceMatch = this.computeExperienceMatch(notice, contracts);
    const affinityGeographical = this.computeGeographicAffinity(company, notice, contracts);

    const totalScore = Number(
      (
        technicalFit.score +
        economicFit.score +
        experienceMatch.score +
        affinityGeographical.score
      ).toFixed(2),
    );

    // Natural Language Justification
    const justification = `Puntaje total de afinidad: ${totalScore}/100. Desglose: Technical Fit de ${technicalFit.score}/40 (cruce UNSPSC: ${technicalFit.unspscMatch}, similitud semántica: ${technicalFit.semanticSimilarity}), Economic Fit de ${economicFit.score}/25 (desviación de presupuesto: ${economicFit.ticketDeviation}, flujo de caja mensual: ${economicFit.cashFlowCapacity}), Experience Match de ${experienceMatch.score}/20 (densidad sectorial: ${experienceMatch.unspscDensity}, similitud semántica de experiencia: ${experienceMatch.semanticSimilarity}), y afinidad geográfica/entidad de ${affinityGeographical.score}/15.`;

    return {
      score: totalScore,
      vectorBreakdown: {
        technicalFit,
        economicFit,
        experienceMatch,
        affinityGeographical,
      },
      justification,
    };
  }

  /**
   * Computes Technical Fit (0-40 points) between a company and a notice.
   * Based on UNSPSC segment/family/class matches and cosine similarity of description/sectors.
   *
   * @param company - The company profile.
   * @param notice - The procurement notice.
   * @returns An object containing unspscMatch, semanticSimilarity, and score components.
   */
  private computeTechnicalFit(
    company: Company,
    notice: ProcurementNotice,
  ): { unspscMatch: number; semanticSimilarity: number; score: number } {
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

    return {
      unspscMatch,
      semanticSimilarity: techSemantic,
      score: technicalFitScore,
    };
  }

  /**
   * Computes Economic Fit (0-25 points) between a company and a notice.
   * Based on the deviation between notice value and target ticket, and working capital capacity.
   *
   * @param company - The company profile.
   * @param notice - The procurement notice.
   * @returns An object containing ticketDeviation, cashFlowCapacity, and score components.
   */
  private computeEconomicFit(
    company: Company,
    notice: ProcurementNotice,
  ): { ticketDeviation: number; cashFlowCapacity: number; score: number } {
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

    return {
      ticketDeviation: ticketDeviationScore,
      cashFlowCapacity: cashFlowCapacityScore,
      score: economicFitScore,
    };
  }

  /**
   * Computes Experience Match (0-20 points) based on company contracts and notice requirements.
   * Matches past contract descriptions semantically and calculates density of matching UNSPSC codes.
   *
   * @param notice - The procurement notice.
   * @param contracts - The list of company contracts.
   * @returns An object containing semanticSimilarity, unspscDensity, and score components.
   */
  private computeExperienceMatch(
    notice: ProcurementNotice,
    contracts: CompanyContract[],
  ): { semanticSimilarity: number; unspscDensity: number; score: number } {
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

    return {
      semanticSimilarity: expSemantic,
      unspscDensity,
      score: experienceMatchScore,
    };
  }

  /**
   * Computes Affinity & Geographical Match (0-15 points) based on location and past clients.
   * Checks prior client relations via NIT matching and regional presence using DIVIPOLA codes.
   *
   * @param company - The company profile.
   * @param notice - The procurement notice.
   * @param contracts - The list of company contracts.
   * @returns An object containing clientAffinity, geographicPresence, and score components.
   */
  private computeGeographicAffinity(
    company: Company,
    notice: ProcurementNotice,
    contracts: CompanyContract[],
  ): { clientAffinity: number; geographicPresence: number; score: number } {
    const liquidContracts = contracts.filter((c) => c.status?.toUpperCase() === 'LIQUIDADO');

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
        // Assume presence if there are 3+ contracts executed in that same department
        return false;
      }).length;

      if (isRegisteredRegion || pastContractsInDept >= 3) {
        geographicPresence = 5;
      }
    }
    const affinityGeographicalScore = Number((clientAffinity + geographicPresence).toFixed(2));

    return {
      clientAffinity,
      geographicPresence,
      score: affinityGeographicalScore,
    };
  }
}

