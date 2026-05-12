import * as net from 'node:net';
import { ConfigService } from '@nestjs/config';

function connect(host: string, port: number, timeoutMs = 1500) {
  return new Promise<void>((resolve, reject) => {
    const socket = net.createConnection({ host, port });

    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('timeout'));
    }, timeoutMs);

    socket.once('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolve();
    });

    socket.once('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

export async function checkRedisHealth(configService: ConfigService) {
  const host = configService.get<string>('REDIS_HOST');
  const port = configService.get<number>('REDIS_PORT');

  if (!host || !port) {
    return { name: 'redis', status: 'disabled' as const, details: 'not configured' };
  }

  try {
    await connect(host, port);
    return { name: 'redis', status: 'up' as const };
  } catch (error) {
    return {
      name: 'redis',
      status: 'down' as const,
      details: error instanceof Error ? error.message : 'unknown error',
    };
  }
}
