import { restricoesDePontosPublicos } from '../../tools/eslint/pontos-de-entrada-publicos.mjs';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      'fronteira-das-bibliotecas/ponto-de-entrada-publico': [
        'error',
        ...restricoesDePontosPublicos(true),
      ],
    },
  },
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
