import nx from '@nx/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';
import css from '@eslint/css';
import { tailwind4 } from 'tailwind-csstree';

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
    // Métricas de qualidade (CONTRIBUTING.md, seção "Métricas de qualidade"): o aviso é a medida.
    // Valem em produção, specs e E2E, como aviso até o projeto zerar a dívida; os clientes OpenAPI
    // gerados ficam fora.
    files: ['**/*.ts'],
    ignores: ['libs/shared-data/src/lib/api/*/schema.ts', 'src/lib/api/*/schema.ts'],
    plugins: { sonarjs },
    rules: {
      'max-lines': ['warn', { max: 400, skipBlankLines: false, skipComments: false }],
      'max-lines-per-function': ['warn', { max: 15, skipBlankLines: false, skipComments: false }],
      complexity: ['warn', 10],
      'max-params': ['warn', 4],
      'sonarjs/cognitive-complexity': ['warn', 15],
    },
  },
  {
    // Nos testes, a função passada ao describe agrupa os casos e seria medida inteira: o limite por
    // função fica desligado na camada de testes. Os demais limites valem.
    files: ['**/*.spec.ts', '**/*.setup.ts'],
    rules: {
      'max-lines-per-function': 'off',
    },
  },
  {
    // Templates: o parser de template do angular-eslint vem da configuração de cada projeto.
    files: ['**/*.html'],
    rules: {
      'max-lines': ['warn', { max: 400, skipBlankLines: false, skipComments: false }],
    },
  },
  {
    // CSS com a sintaxe do Tailwind 4 (CONTRIBUTING.md, seção "Lint de CSS"). Os tokens do Uni+ DS
    // são definidos em outro arquivo, por isso variável desconhecida não é erro.
    files: ['**/*.css'],
    plugins: { css },
    language: 'css/css',
    languageOptions: { customSyntax: tailwind4 },
    rules: {
      ...css.configs.recommended.rules,
      'css/no-invalid-properties': ['error', { allowUnknownVariables: true }],
      'css/relative-font-units': ['error', { allowUnits: ['rem', 'em'] }],
      'css/use-baseline': [
        'error',
        {
          // Acabamento que o navegador sem suporte ignora sem prejuízo do uso.
          allowProperties: [
            'accent-color',
            'overscroll-behavior',
            'print-color-adjust',
            'resize',
            'scrollbar-color',
            'scrollbar-gutter',
            'scrollbar-width',
            'user-select',
          ],
          allowPropertyValues: { 'break-after': ['avoid'] },
          allowAtRules: ['page'],
          allowSelectors: ['marker'],
        },
      ],
    },
  },
  {
    // Camadas que precisam vencer a especificidade de qualquer componente: utilitários de leitor de
    // tela e de impressão, preferência de movimento reduzido e o documento no papel.
    files: [
      'libs/shared-ui/src/styles/base.css',
      'libs/shared-ui/src/styles/tokens/preferencias-do-usuario.css',
      '**/*-impressao.css',
    ],
    rules: { 'css/no-important': 'off' },
  },
  {
    // No papel, pt é a unidade de tamanho de fonte.
    files: ['**/*-impressao.css'],
    rules: { 'css/relative-font-units': 'off' },
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
