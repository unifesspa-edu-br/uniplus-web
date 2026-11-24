import {
  ComposicaoVagasCodigo,
  ModalidadeDto,
  NaturezaLegalCodigo,
  RegraRemanejamentoCodigo,
} from '@uniplus/shared-data/configuracao';

export const NATUREZAS = {
  ampla: { codigo: NaturezaLegalCodigo.AMPLA, rotulo: 'Natureza recebida A' },
  cota: { codigo: NaturezaLegalCodigo.COTA_RESERVADA, rotulo: 'Natureza recebida B' },
  acao: { codigo: NaturezaLegalCodigo.ACAO_AFIRMATIVA, rotulo: 'Natureza recebida C' },
};
export const COMPOSICOES = {
  restante: {
    codigo: ComposicaoVagasCodigo.RESTANTE_DAS_VAGAS_OFERTADAS,
    rotulo: 'Composição recebida A',
  },
  reserva: {
    codigo: ComposicaoVagasCodigo.DENTRO_DA_RESERVA_LEGAL,
    rotulo: 'Composição recebida C',
  },
  suplementar: {
    codigo: ComposicaoVagasCodigo.SUPLEMENTAR_AO_TOTAL,
    rotulo: 'Composição recebida D',
  },
  retirada: {
    codigo: ComposicaoVagasCodigo.RETIRADA_DE_OUTRA_MODALIDADE,
    rotulo: 'Composição recebida B',
  },
};
export const REGRAS = {
  cascata: {
    codigo: RegraRemanejamentoCodigo.SEGUE_ORDEM_DE_REMANEJAMENTO,
    rotulo: 'Regra recebida A',
  },
  destino: { codigo: RegraRemanejamentoCodigo.DESTINO_UNICO, rotulo: 'Regra recebida B' },
  cruzado: { codigo: RegraRemanejamentoCodigo.CRUZADO, rotulo: 'Regra recebida C' },
};
export const MODALIDADE: ModalidadeDto = {
  id: 'id-v',
  codigo: 'V',
  legalFixa: false,
  descricao: 'Modalidade V',
  naturezaLegal: NATUREZAS.ampla,
  composicaoVagas: COMPOSICOES.restante,
  composicaoOrigem: null,
  remanejamento: null,
  regraDeAplicabilidade: [],
  acaoQuandoIndeferido: null,
  baseLegal: null,
  criadoEm: '2026-07-03T12:00:00Z',
};
