import type { FilaDePedidos } from '@uniplus/shared-data/autorizacao';

/** De onde a pessoa chegou ao pedido: a lista de origem e o texto do retorno a ela. */
export interface OrigemDoPedido {
  readonly rota: string;
  readonly voltar: string;
}

export const ORIGEM_PADRAO: OrigemDoPedido = {
  rota: '/acessos/pedidos',
  voltar: 'Voltar aos meus pedidos',
};

export const ORIGEM_POR_FILA: Readonly<Record<FilaDePedidos, OrigemDoPedido>> = {
  meus: ORIGEM_PADRAO,
  gestor: { rota: '/acessos/fila-do-gestor', voltar: 'Voltar à fila do gestor' },
  protecao_de_dados: {
    rota: '/acessos/fila-da-protecao-de-dados',
    voltar: 'Voltar à fila da proteção de dados',
  },
  todos: { rota: '/acessos/historico', voltar: 'Voltar ao histórico de pedidos' },
};

/** A origem que a lista deixou no parâmetro `origem` do link; qualquer outra coisa cai na padrão. */
export function origemDaFila(fila: string | null | undefined): OrigemDoPedido {
  return fila != null && Object.hasOwn(ORIGEM_POR_FILA, fila)
    ? ORIGEM_POR_FILA[fila as FilaDePedidos]
    : ORIGEM_PADRAO;
}
