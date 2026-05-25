import 'reflect-metadata';
import { Company } from '../src/modules/companies/entities/company.entity';
import { ProcurementNotice } from '../src/modules/procurement-notices/entities/procurement-notice.entity';
import { MatchingResult } from '../src/modules/scoring/entities/matching-result.entity';

describe('MatchingResult Entity', () => {
  it('should have the correct properties and relations defined', () => {
    const result = new MatchingResult();
    const company = new Company();
    const notice = new ProcurementNotice();

    result.id = 'result-uuid';
    result.status = 'PASSED';
    result.score = 85.5;
    result.vectorBreakdown = {
      technicalFit: 35,
      economicFit: 20,
      experienceMatch: 15,
      affinityGeographical: 15,
    };
    result.justification = 'Excellent semantic similarity and target ticket match.';
    result.company = company;
    result.notice = notice;

    expect(result.id).toBe('result-uuid');
    expect(result.status).toBe('PASSED');
    expect(result.score).toBe(85.5);
    expect(result.vectorBreakdown).toEqual({
      technicalFit: 35,
      economicFit: 20,
      experienceMatch: 15,
      affinityGeographical: 15,
    });
    expect(result.justification).toBe('Excellent semantic similarity and target ticket match.');
    expect(result.company).toBe(company);
    expect(result.notice).toBe(notice);
  });
});
