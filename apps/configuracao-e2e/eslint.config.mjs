import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  playwright.configs['flat/recommended'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      // Helpers de asserção do próprio app: sem declará-los, a regra acusa
      // "Test has no assertions" em teste que assere dentro do helper.
      'playwright/expect-expect': [
        'warn',
        { assertFunctionNames: ['assertSemViolacoesGraves'] },
      ],
    },
  },
];
