/** @type {import('ts-jest/dist/types').JestConfigWithTsJest} */
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testTimeout: 200000,
    //setupFilesAftexrEnv: ["<rootDir>/jestSetup.ts"],
    transform: {
      '^.+\\.ts$': ['ts-jest', {
        tsconfig: 'tsconfig.json',
        // other ts-jest options
      }],
    }
  }