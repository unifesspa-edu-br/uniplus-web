import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type { WizardDraft } from '../processo-seletivo.models';
import { etapaDoServidor, faseDoServidor } from './cronograma-do-servidor.testing';

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
  vagasOfertadasBase: 40,
  percentualDaReservaLegal: 0.5,
  regraDistribuicao: { codigo: 'DISTRIB-VAGAS-LEI-12711', versao: 'v1' },
  ramoDaDistribuicao: 'LEI_DE_COTAS',
  regraAjuste: { codigo: 'RECONCILIACAO-VAGAS-ART11-PU', versao: 'v1' },
  ajusteDoQuadro: null,
  referenciaDemografica: { id: 'snapshot-ref', origemId: 'ref-1' },
  modalidades: [
    {
      id: 'snapshot-m',
      modalidadeOrigemId: 'modalidade-1',
      codigo: 'AC',
      composicaoVagas: 'RestanteDasVagasOfertadas',
      quantidadeDeclarada: null,
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
      composicaoVagas: 'RetiradaDeOutraModalidade',
      quantidadeDeclarada: 2,
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
    cronogramaFases: [],
    etapas: [],
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

export const FASE_COM_RECURSO = faseDoServidor();

export const ETAPA = etapaDoServidor();

/** Reaproveita a base de `dtoCom`, que traz o que `hidratarDraft` lê fora do cronograma. */
export function dtoComCronograma(extra: Record<string, unknown>): ProcessoSeletivoDto {
  return { ...dtoCom([]), ...extra } as unknown as ProcessoSeletivoDto;
}

/** Quadro fixado no edital em que a oferta declarou 25 e 15 e o ajuste do quadro reduziu AC para 20. */
export const FIXADO_COM_AJUSTE = {
  ...DISTRIBUICAO,
  regraDistribuicao: { codigo: 'DISTRIB-VAGAS-INSTITUCIONAL', versao: 'v1' },
  ramoDaDistribuicao: 'QUADRO_FIXADO_NO_EDITAL',
  percentualDaReservaLegal: null,
  regraAjuste: null,
  referenciaDemografica: null,
  ajusteDoQuadro: { $tipo: 'reduzirDe', modalidadeCodigo: 'AC' },
  modalidades: [
    { ...DISTRIBUICAO.modalidades[0], quantidadeDeclarada: 25 },
    { ...DISTRIBUICAO.modalidades[1], quantidadeDeclarada: 15 },
  ],
  quadro: [
    { modalidadeOrigemId: 'modalidade-1', modalidadeCodigo: 'AC', quantidade: 20 },
    { modalidadeOrigemId: 'modalidade-2', modalidadeCodigo: 'AC_PCD', quantidade: 15 },
  ],
};
