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
          prefix: 'cfg',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        [
          { type: 'element', prefix: 'cfg', style: 'kebab-case' },
          { type: 'attribute', prefix: 'cfg', style: 'camelCase' },
        ],
      ],
      'no-restricted-syntax': ['error', ...SELETORES_DE_COMPONENTE],
    },
  },
  {
    // As páginas consomem a API por meio dos clientes de `@uniplus/shared-data`, nunca pelo HttpClient.
    files: ['**/src/app/features/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@angular/common/http',
              importNames: ['HttpClient'],
              message: 'Use um cliente de @uniplus/shared-data em vez do HttpClient.',
            },
          ],
        },
      ],
    },
  },
  blocoDaLeituraNosModelos('warn'),
];
