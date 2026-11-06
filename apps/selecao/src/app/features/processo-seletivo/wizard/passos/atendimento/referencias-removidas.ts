/**
 * As referências que o rascunho guarda mas o cadastro ativo já não tem: seguem visíveis, sem opção
 * de escolher de novo.
 */
export function referenciasRemovidas<T extends { readonly id: string }>(
  selecionadas: readonly T[],
  ativas: readonly { readonly id: string }[],
): readonly T[] {
  const ids = new Set(ativas.map((item) => item.id));
  return selecionadas.filter((item) => !ids.has(item.id));
}

/**
 * Mensagem que nomeia as referências removidas de uma lista. O servidor resolve cada id no cadastro
 * **vivo** e recusa com 422 se qualquer um não existir mais lá. Sem este diagnóstico local,
 * "Gravar e avançar" falharia sempre que o rascunho guardasse uma referência removida, e nada na
 * tela apontaria qual item é a causa. `undefined` quando a lista está vazia.
 */
export function mensagemDeRemovidos(
  singular: string,
  plural: string,
  itens: readonly { readonly nome: string }[],
  genero: 'feminino' | 'masculino',
): string | undefined {
  if (itens.length === 0) return undefined;
  const nomes = itens.map((item) => item.nome).join(', ');
  const final = genero === 'feminino' ? 'a' : 'o';
  return itens.length === 1
    ? `Remova ${singular} "${nomes}", que já foi removid${final} do cadastro, antes de gravar.`
    : `Remova ${plural} que já foram removid${final}s do cadastro antes de gravar: ${nomes}.`;
}
