const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { runInNewContext } = require('node:vm');

const configSource = readFileSync(
  `${__dirname}/jest-assets.config.cjs`,
  'utf8',
);

function loadConfig(url, nodeEnv = 'test') {
  const env = {
    DATABASE_URL: 'postgresql://app/production',
    TEST_DATABASE_URL: url,
    NODE_ENV: nodeEnv,
  };
  runInNewContext(configSource, {
    process: { env },
    URL,
    __dirname,
    module: {},
  });
  return env.DATABASE_URL;
}

test('asset tests reject missing, remote, app and query-overridden database targets', () => {
  for (const url of [
    undefined,
    'postgresql://localhost/nuoi_ong',
    'postgresql://remote.example/nuoi_ong_test',
    'https://localhost/nuoi_ong_test',
    'postgresql://localhost/nuoi_ong_test?host=remote.example',
    'postgresql://localhost/nuoi_ong_test#fragment',
  ])
    assert.throws(() => loadConfig(url), undefined, String(url));
  assert.throws(() =>
    loadConfig('postgresql://localhost/nuoi_ong_test', 'production'),
  );
});

test('asset tests replace the app URL with the explicit local test database', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const url = `postgresql://tester:password@${host}:55439/nuoi_ong_asset_test`;
    assert.equal(loadConfig(url), url);
  }
});
