import { DataSource } from 'typeorm';

export async function checkPostgresHealth(dataSource: DataSource) {
  try {
    await Promise.race([
      dataSource.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
    ]);
    return { name: 'database', status: 'up' as const };
  } catch (error) {
    return {
      name: 'database',
      status: 'down' as const,
      details: error instanceof Error ? error.message : 'unknown error',
    };
  }
}
