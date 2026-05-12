import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { bootstrap } from '../src/main';

jest.mock('../src/app.module', () => ({
  AppModule: class AppModuleMock {},
}));

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn(),
  },
}));

describe('bootstrap', () => {
  it('starts on port from ConfigService', async () => {
    const fakeApp = {
      get: jest.fn().mockReturnValue({ getOrThrow: jest.fn().mockReturnValue(4123) }),
      setGlobalPrefix: jest.fn(),
      useGlobalPipes: jest.fn(),
      enableCors: jest.fn(),
      listen: jest.fn().mockResolvedValue(undefined),
    };

    (NestFactory.create as jest.Mock).mockResolvedValue(fakeApp);

    await bootstrap();

    expect(fakeApp.listen).toHaveBeenCalledWith(4123);
    expect(fakeApp.setGlobalPrefix).toHaveBeenCalledWith('api');
    expect(fakeApp.get).toHaveBeenCalledWith(ConfigService);
  });
});
