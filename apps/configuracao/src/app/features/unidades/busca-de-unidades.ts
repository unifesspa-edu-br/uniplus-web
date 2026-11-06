/** Tamanho máximo da busca por texto que a API aceita (`q`, UnidadesController). */
export const TAMANHO_MAXIMO_DA_BUSCA = 256;

interface Escrevivel {
  set(valor: string): void;
}

/** Zera a busca e o filtro por tipo: o único lugar que sabe o que "limpar" significa. */
export function limparBusca(termoBusca: Escrevivel, tipoFiltro: Escrevivel): void {
  termoBusca.set('');
  tipoFiltro.set('');
}
