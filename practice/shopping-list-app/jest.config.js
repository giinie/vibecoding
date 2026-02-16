module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testTimeout: 10000,
  transform: {
    'client/src/.+\\.js$': 'babel-jest',
  },
  transformIgnorePatterns: [
    '/node_modules/',
  ],
};
