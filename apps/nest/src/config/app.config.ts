export interface AppConfig {
  port: number;
  nodeEnv: string;
}

export const appConfig = (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
});
