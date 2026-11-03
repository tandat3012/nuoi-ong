const u = new URL(process.env.DATABASE_URL || 'http://invalid');
if (
  process.env.NODE_ENV === 'production' ||
  !['postgres:', 'postgresql:'].includes(u.protocol) ||
  !!u.search ||
  !!u.hash ||
  !['localhost', '127.0.0.1'].includes(u.hostname) ||
  !u.pathname.endsWith('_test')
)
  throw Error('Maintenance tests require a local _test database');
module.exports = {
  rootDir: __dirname,
  testEnvironment: 'node',
  maxWorkers: 1,
  testMatch: ['<rootDir>/maintenance-workflow.integration.e2e-spec.ts'],
  transform: { '^.+\\.(t|j)s$': 'ts-jest' },
};
