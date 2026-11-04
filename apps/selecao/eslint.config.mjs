import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

// Seletor com atributo em qualquer elemento que não seja `tr`, `table` ou `details`.
const ATRIBUTO_FORA_DE_TR_TABLE_DETAILS = String.raw`/(^|,)\s*(?!(tr|table|details)\[)[a-zA-Z0-9-]*\[/`;

const SELETORES_DE_COMPONENTE = [
  'Literal[value=%ATRIBUTO%]',
  'TemplateLiteral > TemplateElement[value.cooked=%ATRIBUTO%]',
].map((alvo) => ({
  selector: `Decorator[expression.callee.name='Component'] Property[key.name='selector'] > ${alvo.replaceAll('%ATRIBUTO%', ATRIBUTO_FORA_DE_TR_TABLE_DETAILS)}`,
  message:
    'Componente usa seletor de elemento (`sel-x`). Seletor de atributo só vale em `tr`, `table` e `details`, onde o HTML obriga.',
}));

// Listas de valores de catálogo institucional não se declaram no wizard: vêm dos clientes da API.
const CATALOGOS_DA_API = [
  'CURSOS',
  'ATENDIMENTO_CONDICOES',
  'ATENDIMENTO_RECURSOS',
  'PCD_TIPOS',
  'CRITERIOS_DESEMPATE',
  'DOC_ETAPAS',
  'POLOS',
  'FATOS_CANDIDATO',
  'FATOS_DO_CANDIDATO',
  'SEXOS',
  'NACIONALIDADES',
  'CORES_RACA',
].join('|');
const NAO_DECLARA_CATALOGO = [
  `VariableDeclarator[id.name=/^(${CATALOGOS_DA_API})$/]`,
  `ExportSpecifier[exported.name=/^(${CATALOGOS_DA_API})$/]`,
].map((selector) => ({
  selector,
  message:
    'Catálogo institucional vem de um cliente de @uniplus/shared-data, não de uma lista declarada no wizard.',
}));

const ROTULOS_DE_NAVEGACAO = 'PASSOS|ROTULOS_DOS_PASSOS|REVIEW_NAMES';
const SOMENTE_ROTULOS_DE_NAVEGACAO = [
  `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name!=/^(${ROTULOS_DE_NAVEGACAO})$/]`,
  `ExportNamedDeclaration > ExportSpecifier[local.name!=/^(${ROTULOS_DE_NAVEGACAO})$/]`,
].map((selector) => ({
  selector,
  message: 'Este arquivo só exporta rótulos de navegação dos passos.',
}));

const NAO_INJETA_HTTP_CLIENT = [
  {
    selector: "CallExpression[callee.name='inject'][arguments.0.name='HttpClient']",
    message: 'Use um cliente de @uniplus/shared-data em vez de injetar o HttpClient.',
  },
];

const DO_WIZARD = [...SELETORES_DE_COMPONENTE, ...NAO_DECLARA_CATALOGO];

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
          prefix: 'sel',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        [
          { type: 'element', prefix: 'sel', style: 'kebab-case' },
          { type: 'attribute', prefix: 'sel', style: 'camelCase' },
        ],
      ],
      // Seletor de atributo só onde o HTML obriga: `tr`, `table` e `details`.
      'no-restricted-syntax': ['error', ...SELETORES_DE_COMPONENTE],
    },
  },
  {
    files: ['**/src/app/features/processo-seletivo/wizard/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...DO_WIZARD],
    },
  },
  {
    files: ['**/src/app/features/processo-seletivo/wizard/processo-seletivo.data.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...DO_WIZARD, ...SOMENTE_ROTULOS_DE_NAVEGACAO],
    },
  },
  {
    // As páginas consomem a API por meio dos clientes de `@uniplus/shared-data`, nunca pelo HttpClient.
    files: ['**/*.page.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...SELETORES_DE_COMPONENTE, ...NAO_INJETA_HTTP_CLIENT],
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
  {
    files: ['**/src/app/features/processo-seletivo/wizard/**/*.page.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': ['error', ...DO_WIZARD, ...NAO_INJETA_HTTP_CLIENT],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
