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
];
