// Seletor de atributo num componente só vale onde o modelo de conteúdo do HTML obriga o elemento.
const ELEMENTOS_QUE_O_HTML_OBRIGA = [
  'tr',
  'table',
  'details',
  'li',
  'tbody',
  'thead',
  'option',
  'dt',
  'dd',
];

// Seletor com atributo em qualquer elemento fora da lista.
const ATRIBUTO_FORA_DA_LISTA = String.raw`/(^|,)\s*(?!(${ELEMENTOS_QUE_O_HTML_OBRIGA.join('|')})\[)[a-zA-Z0-9-]*\[/`;

/** Entradas de `no-restricted-syntax` que recusam o seletor de atributo fora da lista. */
export const SELETORES_DE_COMPONENTE = [
  'Literal[value=%ATRIBUTO%]',
  'TemplateLiteral > TemplateElement[value.cooked=%ATRIBUTO%]',
].map((alvo) => ({
  selector: `Decorator[expression.callee.name='Component'] Property[key.name='selector'] > ${alvo.replaceAll('%ATRIBUTO%', ATRIBUTO_FORA_DA_LISTA)}`,
  message: `Componente usa seletor de elemento. Seletor de atributo só vale em ${ELEMENTOS_QUE_O_HTML_OBRIGA.map((e) => `\`${e}\``).join(', ')}, onde o HTML obriga.`,
}));
