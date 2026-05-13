const { execSync } = require('child_process');
const { createConnection } = require('net');

function isRedisReachable(host, port, timeout = 1000) {
  return new Promise((resolve) => {
    const socket = createConnection(port, host);
    socket.setTimeout(timeout);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

module.exports = async function globalSetup() {
  if (await isRedisReachable('localhost', 6379)) {
    return;
  }

  console.log('[globalSetup] Redis not reachable; starting docker compose redis...');
  execSync('docker compose -f ../../docker-compose.yml up -d redis', {
    stdio: 'inherit',
  });

  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (await isRedisReachable('localhost', 6379, 500)) {
      console.log('[globalSetup] Redis is now reachable.');
      return;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error('Redis did not become reachable within 30s after docker compose up.');
};
