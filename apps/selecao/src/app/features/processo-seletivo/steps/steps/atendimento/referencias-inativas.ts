/**
 * As referências que o rascunho guarda mas o cadastro ativo já não tem: seguem visíveis, sem opção
 * de escolher de novo.
 */
export function referenciasInativas<T extends { readonly id: string }>(
  selecionadas: readonly T[],
  ativas: readonly { readonly id: string }[],
): readonly T[] {
  const ids = new Set(ativas.map((item) => item.id));
  return selecionadas.filter((item) => !ids.has(item.id));
}

/**
 * Mensagem que nomeia as referências inativas de uma lista. O servidor resolve cada id no cadastro
 * **vivo** e recusa com 422 se qualquer um não existir mais lá. Sem este diagnóstico local,
 * "Gravar e avançar" falharia sempre que o rascunho guardasse uma referência inativa, e nada na
 * tela apontaria qual item é a causa. `undefined` quando a lista está vazia.
 */
export function mensagemDeInativos(
  singular: string,
  plural: string,
  itens: readonly { readonly nome: string }[],
): string | undefined {
  if (itens.length === 0) return undefined;
  const nomes = itens.map((item) => item.nome).join(', ');
  return itens.length === 1
    ? `Remova ${singular} "${nomes}", que já saiu do cadastro ativo, antes de gravar.`
    : `Remova ${plural} que já saíram do cadastro ativo antes de gravar: ${nomes}.`;
}
