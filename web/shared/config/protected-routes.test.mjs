import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { createRouteMatcher } = require(join(dirname(require.resolve('@clerk/nextjs/server')), 'routeMatcher.js'));
const exports = {};
const { outputText } = ts.transpileModule(readFileSync(new URL('../../proxy.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
runInNewContext(outputText, {
  exports,
  require: () => ({ createRouteMatcher, clerkMiddleware: (handler) => handler }),
});

test('warehouse pages require Clerk protection while storefront pages remain public', async () => {
  for (const pathname of ['/warehouses', '/warehouses/warehouse-a', '/counts', '/counts/', '/transfers', '/transfers/', '/inventory']) {
    let protectedCalls = 0;
    await exports.default({ protect: () => { protectedCalls++; return Promise.resolve(); } }, { nextUrl: { pathname } });
    assert.equal(protectedCalls, 1, pathname);
  }
  for (const pathname of ['/', '/products']) {
    await exports.default({ protect: () => assert.fail('Public page was protected') }, { nextUrl: { pathname } });
  }
});
