import { Injectable } from '@nestjs/common';
import { Company } from '../../companies/entities/company.entity';
import { ProcurementNotice } from '../../procurement-notices/entities/procurement-notice.entity';
import { CompanyContract } from '../../companies/entities/company-contract.entity';
import { getDepartmentCode } from '../utils/divipola.utils';

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

@Injectable()
export class HardFiltersService {
  /**
   * Evaluates a procurement notice against a company's hard filters.
   * Excludes notices that don't satisfy financial limits, residual capacity,
   * UNSPSC sector hierarchies, DIVIPOLA geography, excluded modalities/contract types,
   * and deadlines.
   */
  evaluate(
    company: Company,
    notice: ProcurementNotice,
    activeContracts: CompanyContract[],
  ): EvaluationResult {
    // 1. Active Notice Deadline Validation
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

    // 2. Excluded Modality Filter
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

    // 3. Excluded Contract Type Filter
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

    // 4. Financial Capacity Filter
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

    // 5. Geographic Coverage Intersect
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

    // 6. UNSPSC Sector Hierarchy Filter
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

    // 7. Residual Capacity Validation
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

    return {
      passed: true,
      justification: 'La empresa cumple con todos los requisitos y filtros duros establecidos para este proceso.',
    };
  }
}
