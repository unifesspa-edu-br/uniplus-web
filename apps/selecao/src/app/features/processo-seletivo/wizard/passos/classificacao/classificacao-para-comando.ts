import { DefinirClassificacaoRequest, RegraEliminacaoInput } from '@uniplus/shared-data/selecao';

import { NOME_DO_PASSO_DA_FORMULA } from '../../processo-seletivo.data';
import {
  EtapaPontuada,
  RegraEliminacaoConfigurada,
  WizardDraft,
} from '../../processo-seletivo.models';
import { decimalNaForma, inteiroNaForma } from '../../shared/numero-do-campo';
import { componeNota } from '../cronograma/regras-da-etapa';
import {
  FORMATO_DA_ESCALA_DA_NOTA_FINAL,
  escalaDaNotaFinal,
  escalaDaNotaFinalIlegivel,
} from '../../shared/escala-da-nota-final';

/**
 * Código de `RegraCalculoCodigo.ClassificacaoImportada` — a única regra de
 * cálculo cujo ramo dispensa arredondamento e eliminação locais. Não é rótulo do frontend: é o
 * discriminador que decide o shape do corpo, o mesmo que o servidor usa em
 * `DefinirClassificacaoCommandHandler`.
 */
export const REGRA_CALCULO_IMPORTADA = 'CLASSIFICACAO_IMPORTADA';

/**
 * Código de `RegraCalculoCodigo.FormulaMediaPonderada` — a regra de cálculo local cuja nota usa
 * os pesos por área do ENEM. É discriminador, como o de cima: decide se a resolução de Peso por
 * Área vai no corpo.
 */
export const REGRA_CALCULO_MEDIA_PONDERADA = 'FORMULA_MEDIA_PONDERADA';

/** Códigos de `RegraEliminacaoCodigo`, na mesma função de discriminador. */
const ELIM_NOTA_MINIMA_ETAPA = 'ELIMINACAO_NOTA_MINIMA_ETAPA';
const ELIM_CORTE_EM_AREA = 'ELIMINACAO_CORTE_EM_AREA';
const ELIM_ZERO_EM_AREA = 'ELIMINACAO_ZERO_EM_AREA';
const ELIM_FALTA_EM_DIA_DE_PROVA_ENEM = 'ELIMINACAO_FALTA_EM_DIA_DE_PROVA_ENEM';
const ELIM_AUSENCIA_NA_ETAPA = 'ELIMINACAO_AUSENCIA_NA_ETAPA';

/**
 * A classificação exige a resolução de Peso por Área: baseada em ENEM e com a média ponderada
 * local. Espelha `ConfiguracaoClassificacao.ExigeQuadroPesoAreaEnem` do servidor, que exige a
 * resolução nesse caso e a recusa em qualquer outro — por isso o mapeador só a envia aqui.
 */
export function exigeResolucaoPesoAreaEnem(
  classificacao: Pick<WizardDraft['classificacao'], 'regraCalculoCodigo' | 'baseadoEmEnem'>,
): boolean {
  return (
    classificacao.baseadoEmEnem &&
    classificacao.regraCalculoCodigo === REGRA_CALCULO_MEDIA_PONDERADA
  );
}

/** A classificação usa fórmula local — o ramo que exige arredondamento e admite eliminação. */
export function classificacaoUsaFormulaLocal(regraCalculoCodigo: string): boolean {
  return regraCalculoCodigo !== '' && regraCalculoCodigo !== REGRA_CALCULO_IMPORTADA;
}

/**
 * O shape de campos que uma regra de eliminação aceita, espelhando
 * `DefinirClassificacaoCommandHandler.MontarArgs` (`ELIMINACAO_NOTA_MINIMA_ETAPA`
 * exige `etapaRef`+`notaMinima`; `ELIMINACAO_CORTE_EM_AREA` exige `areaCodigo`+`minimo`;
 * `ELIMINACAO_AUSENCIA_NA_ETAPA` exige só `etapaRef`; `ELIMINACAO_ZERO_EM_AREA` não aceita nenhum). Uma regra fora deste conjunto ainda
 * não tem shape reconhecido pela tela — trata como "nenhum campo", igual a
 * `ELIMINACAO_ZERO_EM_AREA`, em vez de adivinhar.
 */
export function eliminacaoUsaEtapaENotaMinima(regraCodigo: string): boolean {
  return regraCodigo === ELIM_NOTA_MINIMA_ETAPA;
}

/** A eliminação por ausência cita só a etapa, sem nota mínima. */
export function eliminacaoUsaSoEtapa(regraCodigo: string): boolean {
  return regraCodigo === ELIM_AUSENCIA_NA_ETAPA;
}

/** Regras que citam uma etapa do cronograma por `etapaRef`. */
export function eliminacaoUsaEtapa(regraCodigo: string): boolean {
  return eliminacaoUsaEtapaENotaMinima(regraCodigo) || eliminacaoUsaSoEtapa(regraCodigo);
}

export function eliminacaoUsaAreaEMinimo(regraCodigo: string): boolean {
  return regraCodigo === ELIM_CORTE_EM_AREA;
}

/** Regras cujo uso exige `baseadoEmEnem === true` (`EliminacaoEnemForaDeProcessoEnem`). */
export function eliminacaoExigeBaseadoEmEnem(regraCodigo: string): boolean {
  return (
    regraCodigo === ELIM_CORTE_EM_AREA ||
    regraCodigo === ELIM_ZERO_EM_AREA ||
    regraCodigo === ELIM_FALTA_EM_DIA_DE_PROVA_ENEM
  );
}

/** A regra que a classificação aceita no máximo uma vez (`falta_em_dia_de_prova_enem_repetida`). */
export function eliminacaoAceitaUmaSoVez(regraCodigo: string): boolean {
  return regraCodigo === ELIM_FALTA_EM_DIA_DE_PROVA_ENEM;
}

/** Texto vazio vira `null` — é assim que um campo não aplicável viaja no comando. */
function naoVazio(texto: string): string | null {
  const limpo = texto.trim();
  return limpo === '' ? null : limpo;
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
  return {
    regraCodigo: regra.regraCodigo,
    regraVersao: regra.regraVersao,
    etapaRef: eliminacaoUsaEtapa(regra.regraCodigo) ? naoVazio(regra.etapaRef) : null,
    notaMinima: eliminacaoUsaEtapaENotaMinima(regra.regraCodigo)
      ? decimalNaForma(regra.notaMinima)
      : null,
    minimo: eliminacaoUsaAreaEMinimo(regra.regraCodigo) ? decimalNaForma(regra.minimo) : null,
    areaCodigo: eliminacaoUsaAreaEMinimo(regra.regraCodigo) ? naoVazio(regra.areaCodigo) : null,
  };
}

/**
 * Converte o rascunho de classificação no `DefinirClassificacaoRequest`
 * inteiro. Sob `CLASSIFICACAO_IMPORTADA`, os três campos de precisão e o vetor
 * de eliminação são forçados aos valores que a regra exige — `null` ou
 * vazio — **independentemente** do que esteja digitado no rascunho, porque
 * trocar de regra de cálculo não precisa apagar o que o operador já preencheu
 * do outro ramo. A resolução de Peso por Área segue a mesma lógica: só viaja quando a
 * classificação a exige, e `null` fora disso.
 */
export function comoComandoDeClassificacao(
  classificacao: WizardDraft['classificacao'],
): DefinirClassificacaoRequest {
  const local = classificacaoUsaFormulaLocal(classificacao.regraCalculoCodigo);

  return {
    regraCalculoCodigo: classificacao.regraCalculoCodigo,
    regraCalculoVersao: classificacao.regraCalculoVersao,
    ...precisaoDoComando(classificacao, local),
    regraOrdemAlocacaoCodigo: classificacao.regraOrdemAlocacaoCodigo,
    regraOrdemAlocacaoVersao: classificacao.regraOrdemAlocacaoVersao,
    regrasEliminacao: local ? classificacao.regrasEliminacao.map(comoComandoDeRegraEliminacao) : [],
    ...dadosDoEnemNoComando(classificacao),
  };
}

function dadosDoEnemNoComando(classificacao: WizardDraft['classificacao']) {
  return {
    baseadoEmEnem: classificacao.baseadoEmEnem,
    resolucaoPesoAreaEnem: exigeResolucaoPesoAreaEnem(classificacao)
      ? naoVazio(classificacao.resolucaoPesoAreaEnem)
      : null,
  };
}

function precisaoDoComando(classificacao: WizardDraft['classificacao'], local: boolean) {
  return {
    regraArredondamentoCodigo: local ? naoVazio(classificacao.regraArredondamentoCodigo) : null,
    regraArredondamentoVersao: local ? naoVazio(classificacao.regraArredondamentoVersao) : null,
    casasArredondamento: local ? inteiroNaForma(classificacao.casasArredondamento) : null,
    escalaNotaFinal: local ? escalaDaNotaFinal(classificacao.escalaNotaFinal) : null,
  };
}

/** O que falta à resolução de Peso por Área para a classificação poder ser gravada. */
export type PendenciaDaResolucao = 'obrigatoria' | 'fora-do-cadastro';

/**
 * Os textos de cada pendência: no resumo do passo, que diz onde corrigir, e sob o próprio campo.
 * Fora do cadastro, a lista lida pode estar velha — a resolução pode ter sido criada noutra aba —,
 * por isso o texto manda atualizá-la antes de trocar a escolha.
 */
export const TEXTO_DA_PENDENCIA_DA_RESOLUCAO: Readonly<
  Record<PendenciaDaResolucao, { readonly resumo: string; readonly campo: string }>
> = {
  obrigatoria: {
    resumo: `Selecione a resolução de Peso por Área usada na nota, no passo ${NOME_DO_PASSO_DA_FORMULA}.`,
    campo: 'Selecione a resolução de Peso por Área usada na nota.',
  },
  'fora-do-cadastro': {
    resumo: `A resolução de Peso por Área escolhida não está no cadastro lido. Se ela foi criada ou corrigida agora, use "Atualizar lista" no passo ${NOME_DO_PASSO_DA_FORMULA}; senão, escolha outra.`,
    campo:
      'Esta resolução não está no cadastro lido. Use "Atualizar lista" se ela foi criada agora, ou escolha outra.',
  },
};

/**
 * A regra única da resolução, para o resumo e para o campo: exigida sem escolha, ou escolhida mas
 * fora do cadastro — quando quem chama leu o cadastro e informa `resolucaoForaDoCadastro`; sem ele,
 * nada foi lido para afirmá-lo.
 */
export function pendenciaDaResolucao(
  classificacao: WizardDraft['classificacao'],
  resolucaoForaDoCadastro: (resolucao: string) => boolean = () => false,
): PendenciaDaResolucao | null {
  if (!exigeResolucaoPesoAreaEnem(classificacao)) return null;
  const resolucao = classificacao.resolucaoPesoAreaEnem;
  if (!resolucao.trim()) return 'obrigatoria';
  return resolucaoForaDoCadastro(resolucao) ? 'fora-do-cadastro' : null;
}

/** Campo do passo Fórmula que a classificação base recusa, com a mensagem que o explica. */
export interface PendenciaDaClassificacaoBase {
  readonly campo: CampoDaClassificacaoBase;
  readonly mensagem: string;
}

export type CampoDaClassificacaoBase =
  | 'regraCalculo'
  | 'regraArredondamento'
  | 'casasArredondamento'
  | 'escalaNotaFinal'
  | 'regraOrdemAlocacao'
  | 'resolucaoPesoAreaEnem';

/**
 * O que falta nos campos que o passo Fórmula coleta — regra de cálculo, ordem de alocação, sob
 * fórmula local o arredondamento e, quando a classificação a exige, a resolução de Peso por Área —,
 * na ordem em que a tela os mostra. É a fonte única do destaque dos campos na Fórmula e das
 * mensagens na Fórmula e na Eliminação: a navegação do wizard é livre, e a Eliminação, que grava o
 * comando de classificação inteiro, não pode supor que o operador passou pela Fórmula antes.
 */
export function pendenciasDaClassificacaoBase(
  classificacao: WizardDraft['classificacao'],
  resolucaoForaDoCadastro: (resolucao: string) => boolean = () => false,
): readonly PendenciaDaClassificacaoBase[] {
  const pendencias: PendenciaDaClassificacaoBase[] = [];
  if (!classificacao.regraCalculoCodigo) pendencias.push(pendenciaDaRegraDeCalculo());
  if (classificacaoUsaFormulaLocal(classificacao.regraCalculoCodigo)) {
    pendencias.push(...pendenciasDaPrecisao(classificacao));
  }
  if (!classificacao.regraOrdemAlocacaoCodigo) pendencias.push(pendenciaDaOrdemDeAlocacao());
  const pendencia = pendenciaDaResolucao(classificacao, resolucaoForaDoCadastro);
  if (pendencia !== null) pendencias.push(pendenciaDaResolucaoParaResumo(pendencia));

  return pendencias;
}

function pendenciaDaResolucaoParaResumo(
  pendencia: PendenciaDaResolucao,
): PendenciaDaClassificacaoBase {
  return {
    campo: 'resolucaoPesoAreaEnem',
    mensagem: TEXTO_DA_PENDENCIA_DA_RESOLUCAO[pendencia].resumo,
  };
}

function pendenciaDaRegraDeCalculo(): PendenciaDaClassificacaoBase {
  return {
    campo: 'regraCalculo',
    mensagem: `Selecione a regra de cálculo da nota, no passo ${NOME_DO_PASSO_DA_FORMULA}.`,
  };
}

function pendenciaDaOrdemDeAlocacao(): PendenciaDaClassificacaoBase {
  return {
    campo: 'regraOrdemAlocacao',
    mensagem: `Selecione a regra de ordem de alocação, no passo ${NOME_DO_PASSO_DA_FORMULA}.`,
  };
}

/** O arredondamento e a escala da nota final, que só a fórmula local usa. */
function pendenciasDaPrecisao(
  classificacao: WizardDraft['classificacao'],
): PendenciaDaClassificacaoBase[] {
  const pendencias: PendenciaDaClassificacaoBase[] = [];
  if (!classificacao.regraArredondamentoCodigo) {
    pendencias.push(pendenciaDoArredondamento());
  }
  if (casasDecimaisInvalidas(classificacao.casasArredondamento))
    pendencias.push(pendenciaDasCasasDecimais());
  if (escalaDaNotaFinalIlegivel(classificacao.escalaNotaFinal)) {
    pendencias.push(pendenciaDaEscala());
  }
  return pendencias;
}

function pendenciaDoArredondamento(): PendenciaDaClassificacaoBase {
  return {
    campo: 'regraArredondamento',
    mensagem: `Selecione a regra de arredondamento, no passo ${NOME_DO_PASSO_DA_FORMULA}.`,
  };
}

function casasDecimaisInvalidas(valor: string): boolean {
  const casas = inteiroNaForma(valor);
  return casas === null || casas <= 0;
}

/** A recusa de um campo do passo da fórmula, com o nome do passo onde corrigi-la. */
export function recusaNoPassoDaFormula(campo: string, recusa: string): string {
  return `${campo}, no passo ${NOME_DO_PASSO_DA_FORMULA}: ${recusa}`;
}

function pendenciaDaEscala(): PendenciaDaClassificacaoBase {
  return {
    campo: 'escalaNotaFinal',
    mensagem: recusaNoPassoDaFormula('Escala da nota final', FORMATO_DA_ESCALA_DA_NOTA_FINAL),
  };
}

function pendenciaDasCasasDecimais(): PendenciaDaClassificacaoBase {
  return {
    campo: 'casasArredondamento',
    mensagem: `Informe as casas decimais de arredondamento, maior que zero, no passo ${NOME_DO_PASSO_DA_FORMULA}.`,
  };
}

/** As mensagens de `pendenciasDaClassificacaoBase`, na mesma ordem. */
export function mensagensDeClassificacaoBase(
  classificacao: WizardDraft['classificacao'],
  resolucaoForaDoCadastro: (resolucao: string) => boolean = () => false,
): readonly string[] {
  return pendenciasDaClassificacaoBase(classificacao, resolucaoForaDoCadastro).map(
    (pendencia) => pendencia.mensagem,
  );
}

/**
 * Sob fórmula local, o divisor da média (`ProcessoSeletivo.CalcularDivisorMedia`)
 * é a soma dos pesos das etapas que compõem a nota — e precisa ser maior que
 * zero, senão o item de conformidade `classificacao_divisor_media_invalido`
 * nasce vermelho. Como toda etapa que compõe a nota declara peso
 * **positivo** (`componeNota`), a soma é positiva sse existe ao menos uma —
 * não há cancelamento a temer.
 */
export function divisorDaMediaValido(etapas: readonly EtapaPontuada[]): boolean {
  return etapas.some(componeNota);
}

/** O campo da recusa do servidor é o da escala da nota final, nomeado como em `ehCampoDaResolucao`. */
export function ehCampoDaEscala(campo: string): boolean {
  return (campo.split('.').at(-1) ?? campo).toLowerCase() === 'escalanotafinal';
}

/**
 * O campo da recusa do servidor é o da resolução de Peso por Área. Compara o nome sem prefixo de
 * caminho (`$.`, `request.`) e sem caixa — a recusa do domínio e a do model binding nomeiam o mesmo
 * campo de formas diferentes.
 */
export function ehCampoDaResolucao(campo: string): boolean {
  return (campo.split('.').at(-1) ?? campo).toLowerCase() === 'resolucaopesoareaenem';
}
