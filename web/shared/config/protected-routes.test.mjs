import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { createRouteMatcher } = require(join(dirname(require.resolve('@clerk/nextjs/server')), 'routeMatcher.js'));
function evaluate(path, requireModule) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  runInNewContext(outputText, { exports, require: requireModule });
  return exports;
}

const protectedRoutes = evaluate('./protected-routes.ts', () => ({}));
const exports = evaluate('../../proxy.ts', (name) =>
  name === '@/shared/config/protected-routes'
    ? protectedRoutes
    : { createRouteMatcher, clerkMiddleware: (handler) => handler },
);

test('warehouse pages require Clerk protection while storefront pages remain public', async () => {
  for (const pathname of ['/warehouses', '/warehouses/warehouse-a', '/counts', '/counts/', '/transfers', '/transfers/', '/inventory', '/checkout', '/orders/abc']) {
    let protectedCalls = 0;
    await exports.default({ protect: () => { protectedCalls++; return Promise.resolve(); } }, { nextUrl: { pathname } });
    assert.equal(protectedCalls, 1, pathname);
  }
  for (const pathname of ['/', '/products']) {
    await exports.default({ protect: () => assert.fail('Public page was protected') }, { nextUrl: { pathname } });
  }
});
