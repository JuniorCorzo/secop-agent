import { SodaIngestionModule } from '../src/modules/soda-ingestion/soda-ingestion.module';
import { ProcurementNoticesModule } from '../src/modules/procurement-notices/procurement-notices.module';
import { ScheduleModule } from '@nestjs/schedule';
import { HttpModule } from '@nestjs/axios';

describe('SodaIngestionModule', () => {
  it('registers ScheduleModule.forRoot, HttpModule, and ProcurementNoticesModule in metadata', () => {
    const imports = Reflect.getMetadata('imports', SodaIngestionModule) ?? [];
    expect(imports).toHaveLength(3);
    expect(imports[0].module).toBe(ScheduleModule);
    expect(imports[1]).toBe(HttpModule);
    expect(imports[2]).toBe(ProcurementNoticesModule);
  });
});
