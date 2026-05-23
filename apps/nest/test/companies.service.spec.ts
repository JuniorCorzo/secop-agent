import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompaniesService } from '../src/modules/companies/services/companies.service';

describe('CompaniesService', () => {
  let repository: any;
  let service: CompaniesService;

  beforeEach(() => {
    repository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };
    service = new CompaniesService(repository as never);
  });

  it('creates a new company', async () => {
    repository.findOne.mockResolvedValue(null);
    repository.create.mockReturnValue({ nit: '123' });
    repository.save.mockResolvedValue({ id: 'uuid', nit: '123' });

    const result = await service.create({ nit: '123', name: 'Test' });

    expect(result.id).toBe('uuid');
    expect(repository.create).toHaveBeenCalled();
  });

  it('rejects duplicate NIT', async () => {
    repository.findOne.mockResolvedValue({ id: 'exists' });

    await expect(service.create({ nit: '123', name: 'Test' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('finds all companies', async () => {
    repository.find.mockResolvedValue([]);
    await service.findAll();
    expect(repository.find).toHaveBeenCalled();
  });

  it('finds one company by id', async () => {
    const company = { id: 'uuid' };
    repository.findOne.mockResolvedValue(company);
    const result = await service.findOne('uuid');
    expect(result).toEqual(company);
  });

  it('throws NotFoundException when company not found', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates a company', async () => {
    const company = { id: 'uuid', nit: 'old' };
    repository.findOne.mockResolvedValueOnce(company); // findOne
    repository.findOne.mockResolvedValueOnce(null); // duplicate check (if nit provided)
    repository.save.mockResolvedValue({ ...company, name: 'New' });

    const result = await service.update('uuid', { name: 'New' });
    expect(result.name).toBe('New');
  });

  it('removes a company', async () => {
    const company = { id: 'uuid' };
    repository.findOne.mockResolvedValue(company);
    repository.remove.mockResolvedValue(company);

    await service.remove('uuid');

    expect(repository.remove).toHaveBeenCalledWith(company);
  });
});
