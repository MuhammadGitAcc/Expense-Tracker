'use strict';

module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  testTimeout: 15000,
};
