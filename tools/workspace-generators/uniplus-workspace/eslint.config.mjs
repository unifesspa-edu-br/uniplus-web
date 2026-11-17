import baseConfig from '../../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    // Projeto sem dívida de métricas: o CI barra.
    files: ['**/*.ts'],
    rules: {
      'max-lines': ['error', { max: 400, skipBlankLines: false, skipComments: false }],
      'max-lines-per-function': ['error', { max: 15, skipBlankLines: false, skipComments: false }],
      complexity: ['error', 10],
      'max-params': ['error', 4],
      'sonarjs/cognitive-complexity': ['error', 15],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.setup.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },
];
