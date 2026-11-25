import nx from '@nx/eslint-plugin';
import { builtinRules } from 'eslint/use-at-your-own-risk';
import sonarjs from 'eslint-plugin-sonarjs';
import css from '@eslint/css';
import { tailwind4 } from 'tailwind-csstree';

const ARQUIVOS_DE_CODIGO = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];

// O apoio de teste (`type:testing`) só chega a quem roda no Vitest; o resto é código de produção.
// Uma lista só gera os globs dos dois blocos de fronteira e o seletor que barra o import relativo.
const NOMES_DE_ARQUIVO_DE_TESTE = ['*.spec', '*.testing', '*.setup', 'test-setup'];
const ARQUIVOS_DE_TESTE = NOMES_DE_ARQUIVO_DE_TESTE.map((nome) => `**/${nome}.ts`);

// `\x2f` é a barra: o seletor do ESLint não aceita `/` dentro da expressão regular.
const INICIO_DO_SEGMENTO = String.raw`(^|[.\x2f])`;
const PONTO_DE_ENTRADA_DE_TESTE = String.raw`\x2ftesting`;
const EXTENSAO_OPCIONAL = String.raw`(\.(ts|js|mts))?`;

function finalDoEspecificador(nome) {
  return nome.startsWith('*') ? String.raw`\.${nome.slice(2)}` : `${INICIO_DO_SEGMENTO}${nome}`;
}

const ESPECIFICADOR_DE_TESTE = String.raw`/(${[
  ...NOMES_DE_ARQUIVO_DE_TESTE.map(finalDoEspecificador),
  PONTO_DE_ENTRADA_DE_TESTE,
].join('|')})${EXTENSAO_OPCIONAL}$/`;

// Cada forma de trazer um módulo por especificador (import, reexportação, `import()` e `require`).
const SELETORES_DE_ESPECIFICADOR = [
  `:matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=${ESPECIFICADOR_DE_TESTE}]`,
  `CallExpression[callee.name='require'][arguments.0.value=${ESPECIFICADOR_DE_TESTE}]`,
];

// O `@nx/enforce-module-boundaries` não olha import relativo dentro do mesmo projeto; esta regra do
// núcleo, com nome que nenhum projeto redefine, fecha essa brecha para arquivo ou ponto de entrada de
// teste (`@angular/core/testing`, `@uniplus/shared-core/http/testing`).
const IMPORTA_ARQUIVO_DE_TESTE = SELETORES_DE_ESPECIFICADOR.map((selector) => ({
  selector,
  message:
    'Arquivo de produção não importa nem reexporta arquivo ou ponto de entrada de teste (.spec, .testing, .setup, test-setup, /testing): o apoio de teste entraria no build.',
}));

// `import x = require()` não passa pelo `@nx/enforce-module-boundaries`: a forma inteira fica proibida.
const IMPORT_COM_REQUIRE = {
  selector: "TSImportEqualsDeclaration[moduleReference.type='TSExternalModuleReference']",
  message:
    'O projeto usa módulos ES: `import x = require()` esconde a fronteira do apoio de teste. Use `import`.',
};

const TIPOS_DE_PRODUCAO = [
  'type:app',
  'type:ui',
  'type:data-access',
  'type:feature',
  'type:util',
  'type:core',
  'type:auth',
  'type:data',
  'type:domain-ui',
  'type:e2e',
];

const IMPORTS_DE_TESTE_BANIDOS = ['vitest', 'vitest/*', '@vitest/*', '@analogjs/vitest-angular*'];

// Eixo `scope:*` (vertical) + eixo `type:*` (horizontal). Toda lib carrega
// `[scope:<X>, type:<Y>]`. Apps de produção (`type:app`) e suítes E2E
// (`type:e2e`) ficam fora do eixo `type` como leaf consumers — não há
// entrada `sourceTag: 'type:app'` ou `'type:e2e'` aqui porque eles
// dependem de qualquer combinação `scope:*` permitida pelo eixo scope
// sem restrição adicional no eixo type.
const RESTRICOES_POR_TAG = [
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
];

// O apoio de teste depende do `shared-core`; o inverso fecharia um ciclo.
const TIPOS_QUE_NAO_USAM_O_APOIO = ['type:core'];

function usaOApoioDeTeste(restricao) {
  return (
    restricao.sourceTag.startsWith('type:') &&
    !TIPOS_QUE_NAO_USAM_O_APOIO.includes(restricao.sourceTag)
  );
}

// App e data acessam documentos do contrato somente em arquivos de teste.
function comApoioDeTeste(restricoes) {
  return restricoes.map((restricao) =>
    usaOApoioDeTeste(restricao)
      ? {
          ...restricao,
          onlyDependOnLibsWithTags: [
            ...restricao.onlyDependOnLibsWithTags,
            'type:testing',
            ...(['type:app', 'type:data'].includes(restricao.sourceTag) ? ['type:contrato'] : []),
          ],
        }
      : restricao,
  );
}

function regraDeFronteira(opcoes) {
  return {
    '@nx/enforce-module-boundaries': [
      'error',
      { allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'], ...opcoes },
    ],
  };
}

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    // Comentário `eslint-disable` não silencia regra nenhuma: a supressão é proibida (CONTRIBUTING, § Métricas de qualidade).
    linterOptions: { noInlineConfig: true },
  },
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      'libs/shared-ui/src/assets/**',
    ],
  },
  {
    // Produção não importa o apoio de teste nem o Vitest; `noInlineConfig` impede silenciar a regra.
    files: ARQUIVOS_DE_CODIGO,
    ignores: ARQUIVOS_DE_TESTE,
    plugins: {
      'apoio-de-teste': {
        rules: { 'arquivo-de-teste-fora-da-producao': builtinRules.get('no-restricted-syntax') },
      },
    },
    rules: {
      'apoio-de-teste/arquivo-de-teste-fora-da-producao': [
        'error',
        ...IMPORTA_ARQUIVO_DE_TESTE,
        IMPORT_COM_REQUIRE,
      ],
      ...regraDeFronteira({
        enforceBuildableLibDependency: true,
        depConstraints: [
          ...RESTRICOES_POR_TAG,
          {
            sourceTag: '*',
            onlyDependOnLibsWithTags: TIPOS_DE_PRODUCAO,
            bannedExternalImports: IMPORTS_DE_TESTE_BANIDOS,
          },
        ],
      }),
    },
  },
  {
    files: ARQUIVOS_DE_TESTE,
    rules: regraDeFronteira({
      enforceBuildableLibDependency: false,
      depConstraints: [
        ...comApoioDeTeste(RESTRICOES_POR_TAG),
        { sourceTag: 'type:testing', onlyDependOnLibsWithTags: ['type:core'] },
      ],
    }),
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
