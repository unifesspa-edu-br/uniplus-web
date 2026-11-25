export function seletoresDoEspecificador(expressao) {
  return [
    `:matches(ImportDeclaration, ExportAllDeclaration, ExportNamedDeclaration, ImportExpression)[source.value=${expressao}]`,
    `CallExpression[callee.name='require'][arguments.0.value=${expressao}]`,
  ];
}
