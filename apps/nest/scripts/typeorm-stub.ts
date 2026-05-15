/**
 * Stub ts-node/register so TypeORM CLI works under Bun.
 *
 * Bun handles TypeScript natively, so ts-node is unnecessary.
 * TypeORM CLI unconditionally requires ts-node when loading .ts data sources.
 * This stub intercepts that require and returns a no-op, letting Bun's
 * native transpiler handle the rest.
 *
 * Also loads .env manually so validateEnvironment() doesn't fail during migration:generate.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '../.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function (id: string) {
  if (
    id === 'ts-node/register' ||
    id === 'ts-node/register/transpile-only'
  ) {
    return {};
  }
  return originalRequire.call(this, id);
};
