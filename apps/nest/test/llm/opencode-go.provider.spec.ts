import { of, throwError } from 'rxjs';
import { OpenCodeGoProvider } from '../../src/modules/llm/providers/opencode-go.provider';

describe('OpenCodeGoProvider', () => {
  let provider: OpenCodeGoProvider;
  let httpServiceMock: any;
  let configServiceMock: any;

  beforeEach(() => {
    httpServiceMock = {
      post: jest.fn(),
      get: jest.fn(),
    };
    configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'LLM_BASE_URL') return 'http://localhost:8080';
        if (key === 'LLM_API_KEY') return 'test-key';
        return undefined;
      }),
    };
    provider = new OpenCodeGoProvider(httpServiceMock, configServiceMock);
  });

  describe('chat', () => {
    it('sends correct request payload to /v1/chat/completions and returns parsed output', async () => {
      const mockResult = {
        data: {
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Hello response',
              },
            },
          ],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 15,
            total_tokens: 25,
          },
        },
      };
      httpServiceMock.post.mockReturnValue(of(mockResult));

      const result = await provider.chat([{ role: 'user', content: 'hello' }], {
        temperature: 0.7,
        maxTokens: 50,
      });

      expect(result).toEqual({
        content: 'Hello response',
        usage: {
          promptTokens: 10,
          completionTokens: 15,
          totalTokens: 25,
        },
      });

      expect(httpServiceMock.post).toHaveBeenCalledWith(
        'http://localhost:8080/v1/chat/completions',
        {
          model: 'opencode-go',
          messages: [{ role: 'user', content: 'hello' }],
          temperature: 0.7,
          max_tokens: 50,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-key',
          },
          timeout: 5000,
        }
      );
    });

    it('defaults temperature and maxTokens when not provided', async () => {
      const mockResult = {
        data: {
          choices: [{ message: { content: 'default response' } }],
        },
      };
      httpServiceMock.post.mockReturnValue(of(mockResult));

      await provider.chat([{ role: 'user', content: 'hello' }]);

      expect(httpServiceMock.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          temperature: 0.3,
          max_tokens: 1000,
        }),
        expect.objectContaining({
          timeout: 5000,
        })
      );
    });
  });

  describe('embed', () => {
    it('sends correct request payload to /v1/embeddings and returns embeddings arrays', async () => {
      const mockResult = {
        data: {
          data: [
            { index: 1, embedding: [0.3, 0.4] },
            { index: 0, embedding: [0.1, 0.2] },
          ],
        },
      };
      httpServiceMock.post.mockReturnValue(of(mockResult));

      const result = await provider.embed(['text1', 'text2']);

      expect(result).toEqual([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);

      expect(httpServiceMock.post).toHaveBeenCalledWith(
        'http://localhost:8080/v1/embeddings',
        {
          model: 'opencode-go',
          input: ['text1', 'text2'],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-key',
          },
        }
      );
    });
  });

  describe('health', () => {
    it('returns true if GET /health responds with status 2xx', async () => {
      httpServiceMock.get.mockReturnValue(of({ status: 200 }));

      const status = await provider.health();

      expect(status).toBe(true);
      expect(httpServiceMock.get).toHaveBeenCalledWith('http://localhost:8080/health', {
        timeout: 2000,
      });
    });

    it('returns false if GET /health fails', async () => {
      httpServiceMock.get.mockReturnValue(throwError(() => new Error('Service down')));

      const status = await provider.health();

      expect(status).toBe(false);
    });
  });
});
