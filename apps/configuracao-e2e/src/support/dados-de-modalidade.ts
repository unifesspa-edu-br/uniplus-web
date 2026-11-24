import type { JsonDaApi } from '@uniplus/shared-e2e';
import type { ModalidadeDto } from '@uniplus/shared-data/configuracao';

/** As modalidades que os specs de fluxo da tela de Modalidades compartilham. */

export const AC_ID = '01960000-0000-7000-0000-0000000000a1';
export const V_ID = '01960000-0000-7000-0000-0000000000b1';

/** A modalidade de ampla concorrência: não remaneja e não retira vagas de outra. */
export const MODALIDADE_AC: JsonDaApi<ModalidadeDto> = {
  id: AC_ID,
  codigo: 'AC',
  legalFixa: true,
  descricao: 'Ampla concorrência',
  naturezaLegal: { codigo: 'AMPLA', rotulo: 'Ampla concorrência' },
  composicaoVagas: {
    codigo: 'RESTANTE_DAS_VAGAS_OFERTADAS',
    rotulo: 'Restante das vagas ofertadas',
  },
  composicaoOrigem: null,
  remanejamento: null,
  regraDeAplicabilidade: [],
  acaoQuandoIndeferido: null,
  baseLegal: null,
  criadoEm: '2026-07-03T12:00:00Z',
};

/** Retira suas vagas de AC e remaneja para AC: referencia AC e bloqueia a remoção dela. */
export const MODALIDADE_V: JsonDaApi<ModalidadeDto> = {
  ...MODALIDADE_AC,
  id: V_ID,
  codigo: 'V',
  legalFixa: false,
  descricao: 'PcD ampla concorrência',
  naturezaLegal: { codigo: 'ACAO_AFIRMATIVA', rotulo: 'Ação afirmativa' },
  composicaoVagas: {
    codigo: 'RETIRADA_DE_OUTRA_MODALIDADE',
    rotulo: 'Retirada de outra modalidade',
  },
  composicaoOrigem: 'AC',
  remanejamento: {
    regra: { codigo: 'DESTINO_UNICO', rotulo: 'Destino único' },
    destino: 'AC',
    par: null,
    fallback: null,
  },
  regraDeAplicabilidade: [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]],
};
