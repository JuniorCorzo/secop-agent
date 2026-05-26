export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | string;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface ChatResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LlmProvider {
  /**
   * Sends a chat completion request to the LLM.
   */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResponse>;

  /**
   * Generates embeddings for a list of input texts.
   */
  embed(texts: string[]): Promise<number[][]>;

  /**
   * Checks the health of the underlying LLM service.
   */
  health(): Promise<boolean>;
}
