/**
 * Stub ts-node/register so TypeORM CLI works under Bun.
 *
 * Bun handles TypeScript natively, so ts-node is unnecessary.
 * TypeORM CLI unconditionally requires ts-node when loading .ts data sources.
 * This stub intercepts that require and returns a no-op, letting Bun's
 * native transpiler handle the rest.
 */
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
