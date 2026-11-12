import type { ItemDaJanelaDto, JanelaDeMigracaoDto } from '@uniplus/shared-data/autorizacao';

export const PERFIL = '01960000-0000-7000-0000-0000000000d1';
export const ABERTA_EM = '2026-11-09T12:00:00Z';
export const PRAZO = '2026-11-12T12:00:00Z';

const ACRESCIMO = 'selecao:processos:aprovar';

const ITEM_AGUARDANDO_O_LOTE = {
  concessaoId: 'c1',
  beneficiarioNome: 'Betina Teste',
  escopoTipo: 'unidade',
  unidadeId: 'unidade-1',
  validaAte: null,
  versaoAtual: 1,
  exigeProtecaoDeDados: false,
  situacao: 'aguardando_lote',
  // TODO(codegen api#2363): a dispensa sai das linhas da janela; some daqui com o tipo gerado.
  dispensa: null,
  ehDoLeitor: false,
} as const satisfies Partial<ItemDaJanelaDto>;

/** Uma concessão aguardando o lote; o acréscimo é novo a cada chamada. */
export function itemDaJanela(parcial: Partial<ItemDaJanelaDto> = {}): ItemDaJanelaDto {
  return { ...ITEM_AGUARDANDO_O_LOTE, acrescimo: [ACRESCIMO], ...parcial };
}

const JANELA_ABERTA = {
  id: 'janela-1',
  perfilId: PERFIL,
  versaoNova: 2,
  versaoAlvo: 2,
  abertaEm: ABERTA_EM,
  prazo: PRAZO,
  encerradaEm: null,
  situacao: 'aberta',
  forma: null,
  loteEnviado: false,
} as const satisfies Partial<JanelaDeMigracaoDto>;

/** Uma janela aberta, sem lote enviado; a lista de itens é nova a cada chamada. */
export function janelaDeMigracao(parcial: Partial<JanelaDeMigracaoDto> = {}): JanelaDeMigracaoDto {
  return { ...JANELA_ABERTA, itens: [], ...parcial };
}
