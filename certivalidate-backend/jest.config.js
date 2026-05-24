module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup-env.js'],
  testPathIgnorePatterns: ['/node_modules/', '/tests/helpers/', '/tests/__mocks__/'],
  testTimeout: 20000,
  verbose: true,
  globalTeardown: '<rootDir>/tests/global-teardown.js',
  // Suites share a real database — parallel execution causes one suite's
  // afterAll cleanup to delete another suite's data mid-run.
  maxWorkers: 1,
  // otplib@13 depends on @scure/base and @noble/hashes (pure ESM).
  // Jest's synchronous require can't load ESM even on Node 24.
  // The mock provides real RFC 6238 TOTP via Node's built-in crypto.
  moduleNameMapper: {
    '^otplib$': '<rootDir>/tests/__mocks__/otplib.js',
  },
}
