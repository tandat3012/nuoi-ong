const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl)
  throw new Error(
    'TEST_DATABASE_URL is required; the asset suites write test data.',
  );

const target = new URL(testDatabaseUrl);
if (
  process.env.NODE_ENV === 'production' ||
  !['postgres:', 'postgresql:'].includes(target.protocol) ||
  !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
  !/^\/[a-z0-9_]+_test$/i.test(target.pathname) ||
  target.search ||
  target.hash
)
  throw new Error(
    'Asset suites require a local PostgreSQL database ending in _test.',
  );

// Override the app URL before dotenv or any suite can create a connection pool.
process.env.DATABASE_URL = testDatabaseUrl;

module.exports = {
  rootDir: __dirname,
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
  maxWorkers: 1,
  testMatch: [
    '<rootDir>/{assets,stock-issues,stock-receipts,stock-counts-transfers}.integration.e2e-spec.ts',
  ],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
};
