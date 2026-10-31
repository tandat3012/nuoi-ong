const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

function load(url, nodeEnv = 'test') {
  const env = {
    DATABASE_URL: 'postgresql://app/production',
    TEST_DATABASE_URL: url,
    NODE_ENV: nodeEnv,
  };
  const base = { exports: {} };
  runInNewContext(readFileSync(`${__dirname}/jest-assets.config.cjs`, 'utf8'), {
    process: { env },
    URL,
    __dirname,
    module: base,
  });
  const module = { exports: {} };
  runInNewContext(
    readFileSync(`${__dirname}/jest-personnel.config.cjs`, 'utf8'),
    { require: () => base.exports, module },
  );
  return { env, config: module.exports };
}
test('personnel suites inherit the local dedicated-database safeguard', () => {
  for (const url of [
    undefined,
    'postgresql://localhost/nuoi_ong',
    'postgresql://remote.example/personnel_test',
    'postgresql://localhost/personnel_test?host=remote.example',
  ])
    assert.throws(() => load(url));
  assert.throws(() =>
    load('postgresql://localhost/personnel_test', 'production'),
  );
  const url = 'postgresql://tester:password@127.0.0.1:55439/personnel_test';
  const { env, config } = load(url);
  assert.equal(env.DATABASE_URL, url);
  assert.deepEqual(Array.from(config.testMatch), [
    '<rootDir>/{personnel,warehouses}.integration.e2e-spec.ts',
  ]);
});
