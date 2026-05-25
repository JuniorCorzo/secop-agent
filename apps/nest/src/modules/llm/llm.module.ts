import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { OpenCodeGoProvider } from './providers/opencode-go.provider';

export const LLM_PROVIDER = 'LLM_PROVIDER';

@Module({
  imports: [HttpModule],
  providers: [
    {
      provide: LLM_PROVIDER,
      useClass: OpenCodeGoProvider,
    },
  ],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
