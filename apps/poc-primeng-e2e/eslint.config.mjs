import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  playwright.configs['flat/recommended'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    rules: {
      // Reconhece como assertions os helpers de captura visual e checagem de
      // focus ring Gov.br. Evita tornar testes apenas-screenshot ruidosos com
      // expects tautológicos.
      'playwright/expect-expect': [
        'warn',
        { assertFunctionNames: ['screenshot', 'checkGovbrFocusRing'] },
      ],
    },
  },
];
