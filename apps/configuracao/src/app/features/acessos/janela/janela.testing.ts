import {
  SituacaoDaConcessaoNaRevisaoCodigo,
  SituacaoDaRevisaoDasConcessoesCodigo,
} from '@uniplus/shared-data/autorizacao';
import { TipoDeEscopo } from '@uniplus/shared-data/autorizacao';
import type { ItemDaJanelaDto, JanelaDeMigracaoDto } from '@uniplus/shared-data/autorizacao';

export const PERFIL = '01960000-0000-7000-0000-0000000000d1';
export const ABERTA_EM = '2026-11-09T12:00:00Z';
export const PRAZO = '2026-11-12T12:00:00Z';

const ACRESCIMO = 'selecao:processos:aprovar';

const ITEM_AGUARDANDO_DECISAO = {
  concessaoId: 'c1',
  beneficiarioNome: 'Betina Teste',
  escopoTipo: TipoDeEscopo.UNIDADE,
  unidadeId: 'unidade-1',
  validaAte: null,
  versaoAtual: 1,
  exigeProtecaoDeDados: false,
  situacao: {
    codigo: SituacaoDaConcessaoNaRevisaoCodigo.AGUARDANDO_DECISOES,
    rotulo: 'Aguarda decisão',
  },
  ehDoLeitor: false,
} as const satisfies Partial<ItemDaJanelaDto>;

/** Uma concessão aguardando decisão; o acréscimo é novo a cada chamada. */
export function itemDaJanela(parcial: Partial<ItemDaJanelaDto> = {}): ItemDaJanelaDto {
  return { ...ITEM_AGUARDANDO_DECISAO, acrescimo: [ACRESCIMO], ...parcial };
}

const REVISAO_ABERTA = {
  id: 'janela-1',
  perfilId: PERFIL,
  versaoNova: 2,
  versaoAlvo: 2,
  abertaEm: ABERTA_EM,
  terminaEm: PRAZO,
  encerradaEm: null,
  situacao: { codigo: SituacaoDaRevisaoDasConcessoesCodigo.ABERTA, rotulo: 'Aberta' },
  forma: null,
  decisoesEnviadas: false,
} as const satisfies Partial<JanelaDeMigracaoDto>;

/** Uma revisão aberta, sem decisões enviadas; a lista de itens é nova a cada chamada. */
export function janelaDeMigracao(parcial: Partial<JanelaDeMigracaoDto> = {}): JanelaDeMigracaoDto {
  return { ...REVISAO_ABERTA, itens: [], ...parcial };
}
