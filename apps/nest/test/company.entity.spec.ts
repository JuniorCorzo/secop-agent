import 'reflect-metadata';
import { Company } from '../src/modules/companies/entities/company.entity';
import { CompanyContract } from '../src/modules/companies/entities/company-contract.entity';

describe('Company Entity', () => {
  it('should have the extended properties defined', () => {
    const company = new Company();
    company.targetTicket = 150000;
    company.workingCapital = 50000;
    company.annualRevenue = 200000;
    company.excludedContractTypes = ['Obra'];
    company.excludedModalities = ['Licitacion Publica'];
    company.unspscMatchPolicy = 'flexible';

    expect(company.targetTicket).toBe(150000);
    expect(company.workingCapital).toBe(50000);
    expect(company.annualRevenue).toBe(200000);
    expect(company.excludedContractTypes).toEqual(['Obra']);
    expect(company.excludedModalities).toEqual(['Licitacion Publica']);
    expect(company.unspscMatchPolicy).toBe('flexible');
  });
});

describe('CompanyContract Entity', () => {
  it('should have the correct properties and relationships defined', () => {
    const contract = new CompanyContract();
    const company = new Company();

    contract.id = 'some-uuid';
    contract.description = 'Test contract';
    contract.unspscCode = '80101507';
    contract.value = 100000.50;
    contract.clientNit = '987654321';
    contract.status = 'LIQUIDADO';
    contract.startDate = new Date('2025-01-01');
    contract.endDate = new Date('2025-12-31');
    contract.company = company;

    expect(contract.id).toBe('some-uuid');
    expect(contract.description).toBe('Test contract');
    expect(contract.unspscCode).toBe('80101507');
    expect(contract.value).toBe(100000.50);
    expect(contract.clientNit).toBe('987654321');
    expect(contract.status).toBe('LIQUIDADO');
    expect(contract.startDate).toEqual(new Date('2025-01-01'));
    expect(contract.endDate).toEqual(new Date('2025-12-31'));
    expect(contract.company).toBe(company);
  });
});
