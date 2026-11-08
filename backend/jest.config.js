'use strict';

module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  // These test files are still empty (Phase 4 and 5). Delete this line when they are written.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/(unit|integration)/(budget|expense)'],
  testTimeout: 15000,
};
