import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

// Seletor com atributo em qualquer elemento que não seja `tr`, `table` ou `details`.
const ATRIBUTO_FORA_DE_TR_TABLE_DETAILS = String.raw`/(^|,)\s*(?!(tr|table|details)\[)[a-zA-Z0-9-]*\[/`;

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
      'no-restricted-syntax': [
        'error',
        ...[
          'Literal[value=%ATRIBUTO%]',
          'TemplateLiteral > TemplateElement[value.cooked=%ATRIBUTO%]',
        ].map((alvo) => ({
          selector: `Decorator[expression.callee.name='Component'] Property[key.name='selector'] > ${alvo.replaceAll('%ATRIBUTO%', ATRIBUTO_FORA_DE_TR_TABLE_DETAILS)}`,
          message:
            'Componente usa seletor de elemento (`sel-x`). Seletor de atributo só vale em `tr`, `table` e `details`, onde o HTML obriga.',
        })),
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
