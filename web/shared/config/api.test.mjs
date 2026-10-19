import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const { getNextConfigEnv } = require('next/dist/lib/static-env');

function evaluate(path, env) {
  const exports = {};
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  runInNewContext(outputText, { exports, process: { env } });
  return exports;
}

for (const [name, env, expected] of [
  ['public URL takes precedence', { NEXT_PUBLIC_API_URL: 'https://public.example.com', API_URL: 'https://legacy.example.com' }, 'https://public.example.com'],
  ['legacy API_URL reaches browser code', { API_URL: 'https://legacy.example.com' }, 'https://legacy.example.com'],
  ['local fallback', {}, 'http://localhost:5050'],
]) {
  test(name, () => {
    const config = evaluate('../../next.config.ts', env).default;
    const browserEnv = getNextConfigEnv(config);
    const api = evaluate('./api.ts', {
      NEXT_PUBLIC_API_URL: browserEnv['process.env.NEXT_PUBLIC_API_URL'],
    });
    assert.equal(api.FULL_API_URL, expected + '/api/v1');
  });
}
