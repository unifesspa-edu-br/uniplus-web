import { faseDoServidor } from './cronograma-do-servidor';
import { regraDaExigencia } from './regra-de-comprovacao-do-servidor';
import {
  FASES_CANONICAS,
  NOME_DOCUMENTO,
  TIPOS_DOCUMENTO,
  TIPOS_PROCESSO,
} from './catalogos-do-cronograma';
import { PROVA_PRESENCIAL_DECLARADA_SEM_PROVA } from './prova-presencial-declarada';

/**
 * Documentos publicados: o processo da consulta, com uma fase e dois documentos — um cobrado de
 * todo candidato e outro só de quem concorre por LB_PPI. O estado publicado põe o editor em
 * somente leitura.
 */
export const PROCESSO_PUBLICADO_ID = '01960000-0000-7000-0000-000000000a01';
const FASE_PUBLICADA_ID = '01960000-0000-7000-0000-000000000a02';
export const DETALHE_PUBLICADO = {
  id: PROCESSO_PUBLICADO_ID,
  nome: 'Processo seletivo publicado',
  tipoProcesso: { origemId: TIPOS_PROCESSO[0].id, codigo: 'SISU', nome: 'SISU' },
  situacao: { codigo: 'PUBLICADO', rotulo: 'Publicado' },
  origemCandidatos: { codigo: 'INSCRICAO_PROPRIA', rotulo: 'Inscrição própria' },
  unidadeAdministradora: {
    origemId: '01960000-0000-7000-0000-000000000906',
    sigla: 'CEPS',
    slug: 'ceps',
    nome: 'CEPS',
    tipo: 'PROREITORIA',
    cidadeCodigoIbge: '1504208',
    cidadeNome: 'Marabá',
    cidadeUf: 'PA',
  },
  localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
  etapas: [],
  provaPresencial: PROVA_PRESENCIAL_DECLARADA_SEM_PROVA,
  atendimentoEspecializado: null,
  distribuicaoVagas: [],
  fada: null,
  aplicaFada: false,
  cascata: null,
  criteriosDesempate: [],
  classificacao: null,
  cronogramaFases: [
    faseDoServidor({
      id: FASE_PUBLICADA_ID,
      codigo: FASES_CANONICAS[0].codigo,
      faseCanonica: { origemId: FASES_CANONICAS[0].id },
    }),
  ],
  documentosExigidos: [],
  regrasDeComprovacao: [
    regraDaExigencia({
      id: '01960000-0000-7000-0000-000000000a11',
      faseId: FASE_PUBLICADA_ID,
      tipoDocumento: {
        id: TIPOS_DOCUMENTO[0].id,
        codigo: TIPOS_DOCUMENTO[0].codigo,
        nome: NOME_DOCUMENTO,
      },
      obrigatorio: true,
      consequenciaDoDescumprimento: 'ELIMINA_DO_PROCESSO',
    }),
    regraDaExigencia({
      id: '01960000-0000-7000-0000-000000000a12',
      faseId: FASE_PUBLICADA_ID,
      tipoDocumento: {
        id: '01960000-0000-7000-0000-0000000000f9',
        codigo: 'AUTODECLARACAO_PPI',
        nome: 'Autodeclaração étnico-racial',
      },
      obrigatorio: false,
      consequenciaDoDescumprimento: 'RETIRA_A_MODALIDADE',
      condicoes: [
        {
          id: '01960000-0000-7000-0000-000000000a13',
          clausula: 1,
          fato: 'MODALIDADE',
          operador: 'ALGUM_DE',
          valor: '["LB_PPI"]',
        },
      ],
    }),
  ],
  referenciaTemporalFatos: null,
  regrasDerivacao: [],
  formularios: [],
  opcoesDeclaradas: [],
  configuracaoDivulgacao: null,
  configuracaoTaxaInscricao: null,
  algoritmoContagemPrazo: null,
  criadoEm: '2026-09-01T00:00:00Z',
};

/**
 * O mesmo processo com uma segunda fase que exige o mesmo tipo de documento: a consulta monta um
 * `sel-step-fase` por fase, e o que cada um nomeia com id não pode repetir-se no vizinho.
 */
const FASE_PUBLICADA_2_ID = '01960000-0000-7000-0000-000000000a03';
export const DETALHE_DUAS_FASES = {
  ...DETALHE_PUBLICADO,
  cronogramaFases: [
    ...DETALHE_PUBLICADO.cronogramaFases,
    faseDoServidor({
      id: FASE_PUBLICADA_2_ID,
      codigo: FASES_CANONICAS[1].codigo,
      faseCanonica: { origemId: FASES_CANONICAS[1].id, coletaInscricao: false },
      cronograma: { ordem: 2 },
    }),
  ],
  regrasDeComprovacao: [
    ...DETALHE_PUBLICADO.regrasDeComprovacao,
    regraDaExigencia({
      id: '01960000-0000-7000-0000-000000000a21',
      faseId: FASE_PUBLICADA_2_ID,
      tipoDocumento: {
        id: TIPOS_DOCUMENTO[0].id,
        codigo: TIPOS_DOCUMENTO[0].codigo,
        nome: NOME_DOCUMENTO,
      },
      obrigatorio: true,
      consequenciaDoDescumprimento: 'ELIMINA_DO_PROCESSO',
    }),
  ],
};

export type DetalheMockado = typeof DETALHE_PUBLICADO | typeof DETALHE_DUAS_FASES;
