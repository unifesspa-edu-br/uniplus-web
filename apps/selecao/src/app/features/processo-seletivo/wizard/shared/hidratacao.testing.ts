import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type { WizardDraft } from '../processo-seletivo.models';

/** Só o que `hidratarDraft` lê; o resto do rascunho não participa. */
export const DRAFT = { identificacao: {} } as unknown as WizardDraft;

/**
 * Grafia do wire que o detalhe de Seleção emite — PascalCase, e não o token
 * canônico do catálogo de Configuração. Escrever a fixture
 * com o vocabulário do catálogo esconderia o defeito que este arquivo cobre.
 */
export const DISTRIBUICAO = {
  id: 'snapshot-1',
  ofertaCursoOrigemId: 'oferta-1',
  voBase: 40,
  pr: 0.5,
  regraDistribuicao: { codigo: 'DISTRIB-VAGAS-LEI-12711', versao: 'v1' },
  regraAjuste: { codigo: 'RECONCILIACAO-VAGAS-ART11-PU', versao: 'v1' },
  referenciaDemografica: { id: 'snapshot-ref', origemId: 'ref-1' },
  modalidades: [
    {
      id: 'snapshot-m',
      modalidadeOrigemId: 'modalidade-1',
      codigo: 'AC',
      composicaoVagas: 'ResidualDoVo',
      descricao: null,
      composicaoOrigemCodigo: null,
      regraRemanejamento: null,
      remanejamentoDestino: null,
      remanejamentoPar: null,
      remanejamentoFallback: null,
    },
    {
      id: 'snapshot-p',
      modalidadeOrigemId: 'modalidade-2',
      codigo: 'AC_PCD',
      composicaoVagas: 'RetiraDe',
      descricao: null,
      composicaoOrigemCodigo: null,
      regraRemanejamento: null,
      remanejamentoDestino: null,
      remanejamentoPar: null,
      remanejamentoFallback: null,
    },
  ],
  quadro: [
    { modalidadeOrigemId: 'modalidade-1', modalidadeCodigo: 'AC', quantidade: 19 },
    { modalidadeOrigemId: 'modalidade-2', modalidadeCodigo: 'AC_PCD', quantidade: 2 },
  ],
};

export function dtoCom(distribuicao: unknown): ProcessoSeletivoDto {
  return {
    nome: 'PS 2026',
    tipoProcesso: { origemId: 'tipo-1', codigo: 'SISU', nome: 'SiSU' },
    unidadeAdministradora: { origemId: 'unidade-1' },
    origemCandidatos: 'Interno',
    localidade: { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' },
    distribuicaoVagas: distribuicao,
    opcoesDeclaradas: [],
  } as unknown as ProcessoSeletivoDto;
}

/** O que o snapshot guarda da modalidade além do código, com a composição no token canônico. */
export const gravada = (composicaoVagas: string) => ({
  descricao: null,
  composicaoVagas,
  composicaoOrigemCodigo: null,
  regraRemanejamento: null,
  remanejamentoDestino: null,
  remanejamentoPar: null,
  remanejamentoFallback: null,
});

/**
 * Fase que produz resultado e admite recurso — o caso completo. A janela vem com
 * deslocamento, e é assim que precisa voltar: truncar para data perderia a hora
 * que separa o fim de um dia do começo do seguinte.
 */
export const FASE_COM_RECURSO = {
  id: 'snapshot-fase-1',
  ordem: 2,
  faseCanonicaOrigemId: 'fase-canonica-homologacao',
  codigo: 'HOMOLOGACAO',
  origemData: 'NO_EDITAL',
  agrupaEtapas: false,
  permiteComplementacao: true,
  produzResultado: true,
  coletaInscricao: false,
  inicio: '2026-03-25T08:00:00-03:00',
  fim: '2026-03-25T23:59:59-03:00',
  produtos: [
    { id: 'produto-preliminar', atoCodigo: 'RESULTADO_HOMOLOGACAO', papel: 'PRELIMINAR' },
    { id: 'produto-aviso', atoCodigo: 'COMUNICADO_HOMOLOGACAO', papel: null },
  ],
  faseConcluinteCodigo: 'RECURSOS',
  emiteParecerIndividual: true,
  bancasRequeridas: [
    {
      id: 'snapshot-banca',
      tipoBancaOrigemId: 'tipo-banca-1',
      codigo: 'BANCA_ANALISE_RECURSOS',
      recorteDeCompetencia: [
        {
          id: 'snapshot-categoria',
          categoriaDocumentoOrigemId: 'categoria-renda',
          codigo: 'RENDA',
        },
      ],
    },
  ],
  regraRecurso: {
    id: 'snapshot-recurso',
    produtoAncoraId: 'produto-preliminar',
    regra: { codigo: 'RECURSO-PRAZO-ANCORADO-EM-ATO', versao: 'v1', hash: 'abc123' },
    args: {
      prazoValor: 2,
      prazoUnidade: 'diasUteis',
      suspensividadePrimeiraInstanciaValor: null,
      suspensividadePrimeiraInstanciaUnidade: null,
      admiteInstanciaSuperior: true,
      suspensividadeSegundaInstanciaValor: null,
      suspensividadeSegundaInstanciaUnidade: null,
    },
  },
};

export const ETAPA = {
  id: 'etapa-persistida-1',
  nome: 'Prova Objetiva',
  carater: 'classificatoria',
  tipoEtapa: { origemId: 'tipo-etapa-1', codigo: 'PROVA_OBJETIVA', nome: 'Prova Objetiva' },
  peso: 2,
  notaMinima: null,
  ordem: 1,
};

/** Reaproveita a base de `dtoCom`, que traz o que `hidratarDraft` lê fora do cronograma. */
export function dtoComCronograma(extra: Record<string, unknown>): ProcessoSeletivoDto {
  return { ...dtoCom([]), ...extra } as unknown as ProcessoSeletivoDto;
}
