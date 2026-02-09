module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.test.js'],
  modulePathIgnorePatterns: ['<rootDir>/data/backups/'],
  clearMocks: true,
  restoreMocks: true,
};
