/**
 * Quadro de vagas do processo da Medicina 2027 como a api o devolve: a regra da Lei 12.711 com
 * a ampla concorrência para pessoa com deficiência, dez modalidades, e a cascata de
 * remanejamento com oito origens de sete destinos cada. É o volume de dado real que o passo
 * Vagas tem de acomodar na tela estreita; um cenário de duas modalidades não o exercitaria.
 *
 * Só o que o passo lê: o resto do agregado vai vazio.
 */

import { CASCATA_DA_MEDICINA } from './medicina/cascata-da-medicina';
import { DISTRIBUICAO_DA_MEDICINA } from './medicina/distribuicao-da-medicina';
import { FORMULARIO_DAS_MODALIDADES_DA_MEDICINA } from './medicina/formulario-das-modalidades';
import { DERIVACOES_DA_MEDICINA } from './medicina/regras-das-modalidades';

/** Detalhe do processo, com a distribuição, a cascata e as regras congeladas das modalidades. */
export const PROCESSO_DA_MEDICINA = {
  id: '01a0d635-83d6-7a09-b2f6-39b033b686e7',
  nome: 'Processo Seletivo para o Curso de Medicina Unifesspa 2027',
  identificadorLegivel: null,
  tipoProcesso: {
    origemId: '01a0d635-8331-7a95-99a9-aeb7a69bfa46',
    codigo: 'PSM',
    nome: 'Processo Seletivo de Medicina',
  },
  situacao: { codigo: 'PUBLICADO', rotulo: 'Publicado' },
  origemCandidatos: { codigo: 'INSCRICAO_PROPRIA', rotulo: 'Inscrição própria' },
  unidadeAdministradora: {
    origemId: '01a07d6a-a0b2-7448-89a6-a2c7867a0e38',
    sigla: 'CEPS-971713',
    slug: 'ceps',
    nome: 'Centro de Processos Seletivos',
    tipo: 'Centro',
    cidadeCodigoIbge: '1504208',
    cidadeNome: 'Marabá',
    cidadeUf: 'PA',
  },
  localidade: {
    codigoIbge: '1504208',
    nome: 'Marabá',
    uf: 'PA',
  },
  etapas: [],
  atendimentoEspecializado: null,
  distribuicaoVagas: DISTRIBUICAO_DA_MEDICINA,
  fada: null,
  aplicaFada: false,
  cascata: CASCATA_DA_MEDICINA,
  criteriosDesempate: [],
  classificacao: null,
  cronogramaFases: [],
  documentosExigidos: [],
  regrasDeComprovacao: [],
  referenciaTemporalFatos: null,
  regrasDerivacao: DERIVACOES_DA_MEDICINA,
  formularios: [FORMULARIO_DAS_MODALIDADES_DA_MEDICINA],
  opcoesDeclaradas: [],
  configuracaoDivulgacao: null,
  configuracaoTaxaInscricao: null,
  algoritmoContagemPrazo: null,
  criadoEm: '2026-09-25T01:37:06.556296+00:00',
} as const;
