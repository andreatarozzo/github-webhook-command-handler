import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  verbose: true,
  testPathIgnorePatterns: ['dist/'],
  globals: {
    transform: {
      '^.+\\.ts?$': [
        'ts-jest',
        {
          tsconfig: './tsconfig.json',
        },
      ],
    },
  },
};

export default config;
