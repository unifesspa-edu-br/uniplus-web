import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';
import { blocoDaLeituraNosModelos } from '../../tools/eslint/leitura-acompanhada.mjs';
import { SELETORES_DE_COMPONENTE } from '../../tools/eslint/seletor-de-componente.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'ing',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        [
          { type: 'element', prefix: 'ing', style: 'kebab-case' },
          { type: 'attribute', prefix: 'ing', style: 'camelCase' },
        ],
      ],
      'no-restricted-syntax': ['error', ...SELETORES_DE_COMPONENTE],
    },
  },
  blocoDaLeituraNosModelos('warn'),
  {
    // Projeto sem dívida de métricas: o CI barra.
    files: ['**/*.ts'],
    ignores: ['**/src/lib/api/*/schema.ts'],
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
  {
    files: ['**/*.html'],
    rules: { 'max-lines': ['error', { max: 400, skipBlankLines: false, skipComments: false }] },
  },
];
