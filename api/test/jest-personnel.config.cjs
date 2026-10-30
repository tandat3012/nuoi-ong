const guarded = require('./jest-assets.config.cjs');

module.exports = {
  ...guarded,
  testMatch: ['<rootDir>/{personnel,warehouses}.integration.e2e-spec.ts'],
};
