import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom } from 'rxjs';
import { LlmProvider, ChatMessage, ChatOptions, ChatResponse } from '../interfaces/llm-provider.interface';

@Injectable()
export class OpenCodeGoProvider implements LlmProvider {
  private readonly logger = new Logger(OpenCodeGoProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    const rawBaseUrl = this.configService.get<string>('LLM_BASE_URL') ?? '';
    this.baseUrl = rawBaseUrl.replace(/\/$/, '');
    this.apiKey = this.configService.get<string>('LLM_API_KEY') ?? '';
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const payload = {
      model: 'opencode-go',
      messages,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 1000,
    };

    const headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, payload, {
          headers,
          timeout: options?.timeout ?? 5000,
        }),
      );

      const content = response.data?.choices?.[0]?.message?.content ?? '';
      const usage = response.data?.usage;

      return {
        content,
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens ?? 0,
              completionTokens: usage.completion_tokens ?? 0,
              totalTokens: usage.total_tokens ?? 0,
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error(`LLM chat call failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const url = `${this.baseUrl}/v1/embeddings`;
    const payload = {
      model: 'opencode-go',
      input: texts,
    };

    const headers = {
      'Content-Type': 'application/json',
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    };

    try {
      const response = await lastValueFrom(
        this.httpService.post(url, payload, {
          headers,
        }),
      );

      const data = response.data?.data ?? [];
      const sortedData = [...data].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
      return sortedData.map((item) => item.embedding);
    } catch (error) {
      this.logger.error(`LLM embed call failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  async health(): Promise<boolean> {
    const url = `${this.baseUrl}/health`;
    try {
      const response = await lastValueFrom(
        this.httpService.get(url, {
          timeout: 2000,
        }),
      );
      return response.status >= 200 && response.status < 300;
    } catch (error) {
      this.logger.warn(`LLM health check failed: ${error.message}`);
      return false;
    }
  }
}
