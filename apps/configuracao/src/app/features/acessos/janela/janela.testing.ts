import type { ItemDaJanelaDto, JanelaDeMigracaoDto } from '@uniplus/shared-data/autorizacao';

export const PERFIL = '01960000-0000-7000-0000-0000000000d1';
export const ABERTA_EM = '2026-11-09T12:00:00Z';
export const PRAZO = '2026-11-12T12:00:00Z';

const ACRESCIMO = 'selecao:processos:aprovar';

export function itemDaJanela(parcial: Partial<ItemDaJanelaDto> = {}): ItemDaJanelaDto {
  return {
    concessaoId: 'c1',
    beneficiarioNome: 'Betina Teste',
    escopoTipo: 'unidade',
    unidadeId: 'unidade-1',
    validaAte: null,
    versaoAtual: 1,
    acrescimo: [ACRESCIMO],
    exigeProtecaoDeDados: false,
    situacao: 'aguardando_lote',
    dispensa: null,
    ehDoLeitor: false,
    ...parcial,
  };
}

export function janelaDeMigracao(parcial: Partial<JanelaDeMigracaoDto> = {}): JanelaDeMigracaoDto {
  return {
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
    itens: [],
    ...parcial,
  };
}
