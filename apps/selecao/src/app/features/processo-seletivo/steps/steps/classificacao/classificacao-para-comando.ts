import { DefinirClassificacaoRequest, RegraEliminacaoInput } from '@uniplus/shared-data/selecao';

import { EtapaPontuada, RegraEliminacaoConfigurada, WizardDraft } from '../../processo-seletivo.models';
import { componeNota } from '../cronograma/cronograma-do-certame';

/**
 * Código de `RegraCalculoCodigo.ClassificacaoImportada` — a única regra de
 * cálculo cujo ramo dispensa arredondamento e eliminação locais (INV-B8,
 * `ConfiguracaoClassificacao.cs:117-168`). Não é rótulo do frontend: é o
 * discriminador que decide o shape do corpo, o mesmo que o servidor usa em
 * `DefinirClassificacaoCommandHandler`.
 */
export const REGRA_CALCULO_IMPORTADA = 'CLASSIFICACAO-IMPORTADA';

/** Códigos de `RegraEliminacaoCodigo`, na mesma função de discriminador. */
const ELIM_NOTA_MINIMA_ETAPA = 'ELIM-NOTA-MINIMA-ETAPA';
const ELIM_CORTE_REDACAO = 'ELIM-CORTE-REDACAO';
const ELIM_ZERO_EM_AREA = 'ELIM-ZERO-EM-AREA';

/** A classificação usa fórmula local — o ramo que exige arredondamento e admite eliminação. */
export function classificacaoUsaFormulaLocal(regraCalculoCodigo: string): boolean {
  return regraCalculoCodigo !== '' && regraCalculoCodigo !== REGRA_CALCULO_IMPORTADA;
}

/**
 * O shape de campos que uma regra de eliminação aceita, espelhando
 * `DefinirClassificacaoCommandHandler.MontarArgs` (`ELIM-NOTA-MINIMA-ETAPA`
 * exige `etapaRef`+`notaMinima`; `ELIM-CORTE-REDACAO` exige `minimo`;
 * `ELIM-ZERO-EM-AREA` não aceita nenhum). Uma regra fora deste conjunto ainda
 * não tem shape reconhecido pela tela — trata como "nenhum campo", igual a
 * `ELIM-ZERO-EM-AREA`, em vez de adivinhar.
 */
export function eliminacaoUsaEtapaENotaMinima(regraCodigo: string): boolean {
  return regraCodigo === ELIM_NOTA_MINIMA_ETAPA;
}

export function eliminacaoUsaMinimo(regraCodigo: string): boolean {
  return regraCodigo === ELIM_CORTE_REDACAO;
}

/** Regras cujo uso exige `baseadoEmEnem === true` (`EliminacaoEnemForaDeProcessoEnem`). */
export function eliminacaoExigeBaseadoEmEnem(regraCodigo: string): boolean {
  return regraCodigo === ELIM_CORTE_REDACAO || regraCodigo === ELIM_ZERO_EM_AREA;
}

/** Texto vazio vira `null` — é assim que um campo não aplicável viaja no comando. */
function naoVazio(texto: string): string | null {
  const limpo = texto.trim();
  return limpo === '' ? null : limpo;
}

function inteiro(texto: string): number | null {
  const limpo = texto.trim();
  return /^\d+$/.test(limpo) ? Number(limpo) : null;
}

/** Vírgula ou ponto como separador decimal — a mesma gramática do resto do wizard. */
function decimal(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : null;
}

/**
 * Converte uma regra de eliminação configurada no `RegraEliminacaoInput` que o
 * servidor espera. O campo não aplicável ao `regraCodigo` viaja `null`
 * explícito — nunca o texto que possa ter ficado no rascunho de uma escolha
 * anterior, e nunca omitido.
 */
export function comoComandoDeRegraEliminacao(
  regra: RegraEliminacaoConfigurada,
): RegraEliminacaoInput {
  const usaEtapa = eliminacaoUsaEtapaENotaMinima(regra.regraCodigo);
  const usaMinimo = eliminacaoUsaMinimo(regra.regraCodigo);

  return {
    regraCodigo: regra.regraCodigo,
    regraVersao: regra.regraVersao,
    etapaRef: usaEtapa ? naoVazio(regra.etapaRef) : null,
    notaMinima: usaEtapa ? decimal(regra.notaMinima) : null,
    minimo: usaMinimo ? decimal(regra.minimo) : null,
  };
}

/**
 * Converte o rascunho de classificação no `DefinirClassificacaoRequest`
 * inteiro. Sob `CLASSIFICACAO-IMPORTADA`, os três campos de precisão e o vetor
 * de eliminação são forçados aos valores que INV-B8 exige — `null` ou
 * vazio — **independentemente** do que esteja digitado no rascunho, porque
 * trocar de regra de cálculo não precisa apagar o que o operador já preencheu
 * do outro ramo.
 */
export function comoComandoDeClassificacao(
  classificacao: WizardDraft['classificacao'],
): DefinirClassificacaoRequest {
  const local = classificacaoUsaFormulaLocal(classificacao.regraCalculoCodigo);

  return {
    regraCalculoCodigo: classificacao.regraCalculoCodigo,
    regraCalculoVersao: classificacao.regraCalculoVersao,
    regraArredondamentoCodigo: local ? naoVazio(classificacao.regraArredondamentoCodigo) : null,
    regraArredondamentoVersao: local ? naoVazio(classificacao.regraArredondamentoVersao) : null,
    casasArredondamento: local ? inteiro(classificacao.casasArredondamento) : null,
    regraOrdemAlocacaoCodigo: classificacao.regraOrdemAlocacaoCodigo,
    regraOrdemAlocacaoVersao: classificacao.regraOrdemAlocacaoVersao,
    nOpcoesAlocacao: inteiro(classificacao.nOpcoesAlocacao) ?? 0,
    regrasEliminacao: local ? classificacao.regrasEliminacao.map(comoComandoDeRegraEliminacao) : [],
    baseadoEmEnem: classificacao.baseadoEmEnem,
  };
}

/**
 * Sob fórmula local, o divisor da média (`ProcessoSeletivo.CalcularDivisorMedia`)
 * é a soma dos pesos das etapas que compõem a nota — e precisa ser maior que
 * zero, senão o item de conformidade `classificacao_divisor_media_invalido`
 * nasce vermelho (Story #482). Como toda etapa que compõe a nota declara peso
 * **positivo** (`componeNota`), a soma é positiva sse existe ao menos uma —
 * não há cancelamento a temer.
 */
export function divisorDaMediaValido(etapas: readonly EtapaPontuada[]): boolean {
  return etapas.some(componeNota);
}
