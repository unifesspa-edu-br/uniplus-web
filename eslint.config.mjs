import nx from '@nx/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      'libs/shared-ui/src/assets/**',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          // Eixo `scope:*` (vertical) + eixo `type:*` (horizontal). Toda lib carrega
          // `[scope:<X>, type:<Y>]`. Apps de produção (`type:app`) e suítes E2E
          // (`type:e2e`) ficam fora do eixo `type` como leaf consumers — não há
          // entrada `sourceTag: 'type:app'` ou `'type:e2e'` aqui porque eles
          // dependem de qualquer combinação `scope:*` permitida pelo eixo scope
          // sem restrição adicional no eixo type.
          depConstraints: [
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:selecao',
              onlyDependOnLibsWithTags: ['scope:selecao', 'scope:shared'],
            },
            {
              sourceTag: 'scope:ingresso',
              onlyDependOnLibsWithTags: ['scope:ingresso', 'scope:shared'],
            },
            {
              sourceTag: 'scope:portal',
              onlyDependOnLibsWithTags: ['scope:portal', 'scope:shared'],
            },
            {
              sourceTag: 'scope:configuracao',
              onlyDependOnLibsWithTags: ['scope:configuracao', 'scope:shared'],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:ui',
                'type:data-access',
                'type:util',
                'type:core',
                'type:auth',
                'type:data',
                'type:domain-ui',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:util', 'type:core'],
            },
            {
              // `type:domain-ui` é a apresentação de um agregado de domínio compartilhada entre apps
              // (ADR-0030): usa o `type:ui` e lê `type:data` só por tipos, o que a lib reforça no lint.
              sourceTag: 'type:domain-ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:util', 'type:core', 'type:data'],
            },
            {
              // `type:data-access` admite `type:data` porque feature libs HTTP
              // por definição consomem DTOs/schemas/InjectionToken/services de
              // `@uniplus/shared-data` (`type:data`) — `EditalDto`, `EditaisApi`,
              // `SELECAO_BASE_PATH`, `provideRuntimeConfig`. Sem essa entrada,
              // devs forçariam `type:feature` (mais permissivo) e o tipo
              // `data-access` ficaria sem uso prático. Decisão registrada em
              // [#254](https://github.com/unifesspa-edu-br/uniplus-web/issues/254).
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: ['type:util', 'type:core', 'type:data', 'type:auth'],
            },
            {
              sourceTag: 'type:util',
              onlyDependOnLibsWithTags: ['type:util'],
            },
            {
              // `type:core` é leaf no eixo type — não importa nada de outras libs
              // pelo type. Lista vazia bloqueia qualquer dep cross-type.
              sourceTag: 'type:core',
              onlyDependOnLibsWithTags: [],
            },
            {
              sourceTag: 'type:auth',
              onlyDependOnLibsWithTags: ['type:core', 'type:util'],
            },
            {
              // `type:data` admite `type:auth` porque
              // `libs/shared-data/src/lib/config/runtime-config.provider.ts`
              // importa `AUTH_CONFIG` de `@uniplus/shared-auth` (ADR-0021).
              sourceTag: 'type:data',
              onlyDependOnLibsWithTags: ['type:core', 'type:util', 'type:auth'],
            },
          ],
        },
      ],
    },
  },
  {
    // Métricas de qualidade do LT: valem para código de produção e rodam como aviso até o fim
    // da refatoração. O gate de tamanho (`npm run check:tamanho`) segue sendo o que reprova.
    files: ['**/*.ts'],
    ignores: [
      '**/*.spec.ts',
      '**/*.testing.ts',
      '**/*.mock.ts',
      '**/test-setup.ts',
      '**/src/fixtures/**',
      '**/src/support/**',
      'libs/shared-data/src/lib/api/*/schema.ts',
      'src/lib/api/*/schema.ts',
    ],
    plugins: { sonarjs },
    rules: {
      'max-lines': ['warn', { max: 400, skipBlankLines: false, skipComments: false }],
      'max-lines-per-function': ['warn', { max: 30, skipBlankLines: true, skipComments: true }],
      complexity: ['warn', 10],
      'max-params': ['warn', 4],
      'sonarjs/cognitive-complexity': ['warn', 15],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];
