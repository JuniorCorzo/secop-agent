import { Injectable } from '@nestjs/common';
import { Company } from '../../companies/entities/company.entity';
import { ProcurementNotice } from '../../procurement-notices/entities/procurement-notice.entity';
import { CompanyContract } from '../../companies/entities/company-contract.entity';
import { getDepartmentCode } from '../utils/divipola.utils';
import { EvaluationResult } from '../interfaces/evaluation-result.interface';

export { EvaluationResult };

/**
 * Service responsible for evaluating procurement notices against a company's hard exclusion criteria.
 */
@Injectable()
export class HardFiltersService {
  /**
   * Evaluates a procurement notice against a company's hard filters.
   * Excludes notices that don't satisfy financial limits, residual capacity,
   * UNSPSC sector hierarchies, DIVIPOLA geography, excluded modalities/contract types,
   * and deadlines.
   *
   * @param company - The company profile to evaluate against.
   * @param notice - The procurement notice to evaluate.
   * @param activeContracts - The list of currently active/ongoing contracts of the company.
   * @returns An EvaluationResult representing whether the notice passed all hard filters.
   */
  evaluate(
    company: Company,
    notice: ProcurementNotice,
    activeContracts: CompanyContract[],
  ): EvaluationResult {
    const validations = [
      () => this.validateDeadline(notice),
      () => this.validateExcludedModality(company, notice),
      () => this.validateExcludedContractType(company, notice),
      () => this.validateFinancialCapacity(company, notice),
      () => this.validateGeographicCoverage(company, notice),
      () => this.validateUnspscHierarchy(company, notice),
      () => this.validateResidualCapacity(company, notice, activeContracts),
    ];

    for (const validation of validations) {
      const result = validation();
      if (result && !result.passed) {
        return result;
      }
    }

    return {
      passed: true,
      justification: 'La empresa cumple con todos los requisitos y filtros duros establecidos para este proceso.',
    };
  }

  /**
   * Validates the active notice deadline.
   *
   * @param notice - The procurement notice to check.
   * @returns An EvaluationResult if the deadline is expired, or null if it passes.
   */
  private validateDeadline(notice: ProcurementNotice): EvaluationResult | null {
    if (notice.source === 'SECOP_II' && notice.deadlineDate) {
      const deadline = new Date(notice.deadlineDate);
      if (Date.now() > deadline.getTime()) {
        return {
          passed: false,
          reason: 'DEADLINE_EXPIRED',
          justification: `La fecha límite de presentación de propuestas (${deadline.toLocaleDateString()}) ha expirado.`,
        };
      }
    }
    return null;
  }

  /**
   * Validates if the contracting modality is excluded for the company.
   *
   * @param company - The company profile.
   * @param notice - The procurement notice to check.
   * @returns An EvaluationResult if the modality is excluded, or null if it passes.
   */
  private validateExcludedModality(company: Company, notice: ProcurementNotice): EvaluationResult | null {
    if (
      notice.contractingModality &&
      company.excludedModalities &&
      company.excludedModalities.length > 0
    ) {
      const isExcluded = company.excludedModalities.some(
        (m) => m.trim().toLowerCase() === notice.contractingModality!.trim().toLowerCase(),
      );
      if (isExcluded) {
        return {
          passed: false,
          reason: 'MODALITY_EXCLUSION',
          justification: `La modalidad de contratación "${notice.contractingModality}" está excluida en el perfil de la empresa.`,
        };
      }
    }
    return null;
  }

  /**
   * Validates if the contract type is excluded for the company.
   *
   * @param company - The company profile.
   * @param notice - The procurement notice to check.
   * @returns An EvaluationResult if the contract type is excluded, or null if it passes.
   */
  private validateExcludedContractType(company: Company, notice: ProcurementNotice): EvaluationResult | null {
    if (
      notice.contractType &&
      company.excludedContractTypes &&
      company.excludedContractTypes.length > 0
    ) {
      const isExcluded = company.excludedContractTypes.some(
        (t) => t.trim().toLowerCase() === notice.contractType!.trim().toLowerCase(),
      );
      if (isExcluded) {
        return {
          passed: false,
          reason: 'CONTRACT_TYPE_EXCLUSION',
          justification: `El tipo de contrato "${notice.contractType}" está excluido en el perfil de la empresa.`,
        };
      }
    }
    return null;
  }

  /**
   * Validates if the notice value exceeds the company's contracting capacity.
   *
   * @param company - The company profile.
   * @param notice - The procurement notice to check.
   * @returns An EvaluationResult if the notice value exceeds capacity, or null if it passes.
   */
  private validateFinancialCapacity(company: Company, notice: ProcurementNotice): EvaluationResult | null {
    if (notice.value !== null && notice.value !== undefined) {
      const noticeValue = Number(notice.value);
      const companyCapacity = Number(company.contractingCapacity || 0);
      if (noticeValue > companyCapacity) {
        return {
          passed: false,
          reason: 'FINANCIAL_CAPACITY',
          justification: `El valor del proceso (${noticeValue.toLocaleString('es-CO')} COP) supera la capacidad máxima de contratación de la empresa (${companyCapacity.toLocaleString('es-CO')} COP).`,
        };
      }
    }
    return null;
  }

  /**
   * Validates if the notice department matches the company's regional coverage.
   *
   * @param company - The company profile.
   * @param notice - The procurement notice to check.
   * @returns An EvaluationResult if there is a geographic mismatch, or null if it passes.
   */
  private validateGeographicCoverage(company: Company, notice: ProcurementNotice): EvaluationResult | null {
    if (company.regions && company.regions.length > 0) {
      const deptCode = getDepartmentCode(notice.department);
      if (!deptCode || !company.regions.includes(deptCode)) {
        return {
          passed: false,
          reason: 'GEOGRAPHIC_MISMATCH',
          justification: `La ubicación del proceso (${notice.department || 'No especificada'}) no coincide con las regiones de cobertura geográfica de la empresa.`,
        };
      }
    }
    return null;
  }

  /**
   * Validates UNSPSC sector match under company policy.
   *
   * @param company - The company profile.
   * @param notice - The procurement notice to check.
   * @returns An EvaluationResult if there is a UNSPSC sector mismatch, or null if it passes.
   */
  private validateUnspscHierarchy(company: Company, notice: ProcurementNotice): EvaluationResult | null {
    if (notice.unspscCode && company.sectors && company.sectors.length > 0) {
      const policy = company.unspscMatchPolicy || 'strict';
      const matchLen = policy === 'flexible' ? 4 : 6;
      const noticeCodeSub = notice.unspscCode.substring(0, matchLen);

      const hasMatch = company.sectors.some((sector) => {
        const sectorSub = sector.substring(0, matchLen);
        return sectorSub === noticeCodeSub;
      });

      if (!hasMatch) {
        return {
          passed: false,
          reason: 'UNSPSC_MISMATCH',
          justification: `El código UNSPSC del proceso (${notice.unspscCode}) no coincide con los sectores autorizados de la empresa bajo la política de cruce "${policy}".`,
        };
      }
    }
    return null;
  }

  /**
   * Validates residual capacity for civil works (obra) contracts.
   *
   * @param company - The company profile.
   * @param notice - The procurement notice to check.
   * @param activeContracts - The list of active contracts for calculating current execution workload.
   * @returns An EvaluationResult if residual capacity is insufficient, or null if it passes.
   */
  private validateResidualCapacity(
    company: Company,
    notice: ProcurementNotice,
    activeContracts: CompanyContract[],
  ): EvaluationResult | null {
    const isObra = notice.contractType?.toLowerCase() === 'obra';
    if (isObra && notice.value !== null && notice.value !== undefined) {
      const yearsOfExistence =
        (Date.now() - new Date(company.createdAt || Date.now()).getTime()) /
        (1000 * 60 * 60 * 24 * 365.25);

      const fcc =
        yearsOfExistence < 2 || !company.annualRevenue || Number(company.annualRevenue) === 0
          ? Number(company.workingCapital || 0)
          : Number(company.annualRevenue || 0);

      let sce = 0;
      const evalDate = new Date();
      for (const contract of activeContracts) {
        if (contract.status?.toUpperCase() === 'LIQUIDADO') continue;
        if (!contract.startDate || !contract.endDate) continue;
        const start = new Date(contract.startDate);
        const end = new Date(contract.endDate);
        if (start >= end) continue;
        if (evalDate >= end) continue;

        const totalDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
        if (totalDays <= 0) continue;

        let remainingDays = (end.getTime() - evalDate.getTime()) / (1000 * 60 * 60 * 24);
        if (evalDate < start) {
          remainingDays = totalDays;
        }
        sce += (Number(contract.value) / totalDays) * remainingDays;
      }

      const kr = fcc - sce;
      const reqCapacity = Number(notice.value);
      if (reqCapacity > kr) {
        return {
          passed: false,
          reason: 'RESIDUAL_CAPACITY',
          justification: `La capacidad residual requerida para este contrato de obra (${reqCapacity.toLocaleString('es-CO')} COP) supera la capacidad residual neta disponible de la empresa (${kr.toLocaleString('es-CO')} COP, calculada como FCC de ${fcc.toLocaleString('es-CO')} COP menos SCE de ${sce.toLocaleString('es-CO')} COP).`,
        };
      }
    }
    return null;
  }
}

