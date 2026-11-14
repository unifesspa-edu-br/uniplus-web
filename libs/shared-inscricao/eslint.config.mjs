import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
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
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}'],
        },
      ],
    },
    languageOptions: {
      parser: await import('jsonc-eslint-parser'),
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'insc',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'insc',
          style: 'kebab-case',
        },
      ],
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@uniplus/shared-data', '@uniplus/shared-data/*'],
              allowTypeImports: true,
              message: 'A apresentação recebe o DTO; quem lê a API é o container do app.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
