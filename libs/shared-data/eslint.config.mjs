import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/src/lib/api/**/*.api.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ":matches(Program, ExportNamedDeclaration, ExportDefaultDeclaration) > ClassDeclaration:not(:has(Decorator > CallExpression[callee.name='Injectable'] > ObjectExpression > Property[key.name='providedIn'][value.value='root']))",
          message:
            "Toda classe declarada no arquivo deve usar @Injectable({ providedIn: 'root' }).",
        },
        {
          selector:
            "MethodDefinition[kind='method'][static!=true][accessibility!=private][accessibility!=protected] > FunctionExpression > TSTypeAnnotation.returnType > TSTypeReference[typeName.name='Promise']",
          message: 'Método público não deve retornar Promise.',
        },
        {
          selector:
            "MethodDefinition[kind='method'][static!=true][accessibility!=private][accessibility!=protected] > FunctionExpression > TSTypeAnnotation.returnType > TSTypeReference[typeName.name='Observable']:not([typeArguments.params.0.typeName.name='ApiResult'][typeArguments.params.0.typeArguments.params.0.type])",
          message: 'Método público deve retornar Observable<ApiResult<T>>.',
        },
        {
          selector:
            "MethodDefinition[kind='method'][static!=true][accessibility!=private][accessibility!=protected] > FunctionExpression:not([returnType])",
          message: 'Método público deve declarar o tipo de retorno.',
        },
      ],
    },
  },
  {
    // Projeto sem dívida de métricas: o CI barra. O `schema.ts` é gerado pelo OpenAPI.
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
          prefix: 'data',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'data',
          style: 'kebab-case',
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
