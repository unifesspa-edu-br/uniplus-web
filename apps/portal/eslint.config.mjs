import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

// Seletor com atributo em qualquer elemento fora dos que o modelo de conteúdo do HTML obriga.
const ATRIBUTO_FORA_DO_QUE_O_HTML_OBRIGA = String.raw`/(^|,)\s*(?!(tr|table|details|li|tbody|thead|option|dt|dd)\[)[a-zA-Z0-9-]*\[/`;

const SELETORES_DE_COMPONENTE = [
  'Literal[value=%ATRIBUTO%]',
  'TemplateLiteral > TemplateElement[value.cooked=%ATRIBUTO%]',
].map((alvo) => ({
  selector: `Decorator[expression.callee.name='Component'] Property[key.name='selector'] > ${alvo.replaceAll('%ATRIBUTO%', ATRIBUTO_FORA_DO_QUE_O_HTML_OBRIGA)}`,
  message:
    'Componente usa seletor de elemento (`ptl-x`). Seletor de atributo só vale em `tr`, `table`, `details`, `li`, `tbody`, `thead`, `option`, `dt` e `dd`, onde o HTML obriga.',
}));

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
          prefix: 'ptl',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        [
          { type: 'element', prefix: 'ptl', style: 'kebab-case' },
          { type: 'attribute', prefix: 'ptl', style: 'camelCase' },
        ],
      ],
      'no-restricted-syntax': ['error', ...SELETORES_DE_COMPONENTE],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
];
