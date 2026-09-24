import { DefinirClassificacaoRequest, RegraEliminacaoInput } from '@uniplus/shared-data/selecao';

import {
  EtapaPontuada,
  RegraEliminacaoConfigurada,
  WizardDraft,
} from '../../processo-seletivo.models';
import { componeNota } from '../cronograma/cronograma-do-certame';

/**
 * Código de `RegraCalculoCodigo.ClassificacaoImportada` — a única regra de
 * cálculo cujo ramo dispensa arredondamento e eliminação locais (INV-B8,
 * `ConfiguracaoClassificacao.cs:117-168`). Não é rótulo do frontend: é o
 * discriminador que decide o shape do corpo, o mesmo que o servidor usa em
 * `DefinirClassificacaoCommandHandler`.
 */
export const REGRA_CALCULO_IMPORTADA = 'CLASSIFICACAO-IMPORTADA';

/**
 * Código de `RegraCalculoCodigo.FormulaMediaPonderada` — a regra de cálculo local cuja nota usa
 * os pesos por área do ENEM. É discriminador, como o de cima: decide se a resolução de Peso por
 * Área vai no corpo.
 */
export const REGRA_CALCULO_MEDIA_PONDERADA = 'FORMULA-MEDIA-PONDERADA';

/** Códigos de `RegraEliminacaoCodigo`, na mesma função de discriminador. */
const ELIM_NOTA_MINIMA_ETAPA = 'ELIM-NOTA-MINIMA-ETAPA';
const ELIM_CORTE_EM_AREA = 'ELIM-CORTE-EM-AREA';
const ELIM_ZERO_EM_AREA = 'ELIM-ZERO-EM-AREA';

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
 * `DefinirClassificacaoCommandHandler.MontarArgs` (`ELIM-NOTA-MINIMA-ETAPA`
 * exige `etapaRef`+`notaMinima`; `ELIM-CORTE-EM-AREA` exige `areaCodigo`+`minimo`;
 * `ELIM-ZERO-EM-AREA` não aceita nenhum). Uma regra fora deste conjunto ainda
 * não tem shape reconhecido pela tela — trata como "nenhum campo", igual a
 * `ELIM-ZERO-EM-AREA`, em vez de adivinhar.
 */
export function eliminacaoUsaEtapaENotaMinima(regraCodigo: string): boolean {
  return regraCodigo === ELIM_NOTA_MINIMA_ETAPA;
}

export function eliminacaoUsaAreaEMinimo(regraCodigo: string): boolean {
  return regraCodigo === ELIM_CORTE_EM_AREA;
}

/** Regras cujo uso exige `baseadoEmEnem === true` (`EliminacaoEnemForaDeProcessoEnem`). */
export function eliminacaoExigeBaseadoEmEnem(regraCodigo: string): boolean {
  return regraCodigo === ELIM_CORTE_EM_AREA || regraCodigo === ELIM_ZERO_EM_AREA;
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
  const usaAreaEMinimo = eliminacaoUsaAreaEMinimo(regra.regraCodigo);

  return {
    regraCodigo: regra.regraCodigo,
    regraVersao: regra.regraVersao,
    etapaRef: usaEtapa ? naoVazio(regra.etapaRef) : null,
    notaMinima: usaEtapa ? decimal(regra.notaMinima) : null,
    minimo: usaAreaEMinimo ? decimal(regra.minimo) : null,
    areaCodigo: usaAreaEMinimo ? naoVazio(regra.areaCodigo) : null,
  };
}

/**
 * Converte o rascunho de classificação no `DefinirClassificacaoRequest`
 * inteiro. Sob `CLASSIFICACAO-IMPORTADA`, os três campos de precisão e o vetor
 * de eliminação são forçados aos valores que INV-B8 exige — `null` ou
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
    regraArredondamentoCodigo: local ? naoVazio(classificacao.regraArredondamentoCodigo) : null,
    regraArredondamentoVersao: local ? naoVazio(classificacao.regraArredondamentoVersao) : null,
    casasArredondamento: local ? inteiro(classificacao.casasArredondamento) : null,
    regraOrdemAlocacaoCodigo: classificacao.regraOrdemAlocacaoCodigo,
    regraOrdemAlocacaoVersao: classificacao.regraOrdemAlocacaoVersao,
    nOpcoesAlocacao: inteiro(classificacao.nOpcoesAlocacao) ?? 0,
    regrasEliminacao: local ? classificacao.regrasEliminacao.map(comoComandoDeRegraEliminacao) : [],
    baseadoEmEnem: classificacao.baseadoEmEnem,
    resolucaoPesoAreaEnem: exigeResolucaoPesoAreaEnem(classificacao)
      ? naoVazio(classificacao.resolucaoPesoAreaEnem)
      : null,
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
    resumo: 'Selecione a resolução de Peso por Área usada na nota, no passo Fórmula.',
    campo: 'Selecione a resolução de Peso por Área usada na nota.',
  },
  'fora-do-cadastro': {
    resumo:
      'A resolução de Peso por Área escolhida não está no cadastro lido. Se ela foi criada ou corrigida agora, use "Atualizar lista" no passo Fórmula; senão, escolha outra.',
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

/**
 * Mensagens de recusa dos campos que o passo Fórmula coleta — regra de
 * cálculo, ordem de alocação, número de opções, sob fórmula local o
 * arredondamento e, quando a classificação a exige, a resolução de Peso por
 * Área. Compartilhada entre `FormulaStepComponent.validate()` e
 * `EliminacaoStepComponent.validate()`: a navegação do wizard é livre, então
 * a Eliminação — que grava o comando de classificação inteiro — não pode
 * supor que o operador passou pela Fórmula antes de chegar aqui. Sem esta
 * checagem também na Eliminação, um `PUT /classificacao` sairia com
 * `regraOrdemAlocacaoCodigo: ''` ou `nOpcoesAlocacao: 0` sempre que o
 * operador pulasse direto para o último passo.
 */
export function mensagensDeClassificacaoBase(
  classificacao: WizardDraft['classificacao'],
  resolucaoForaDoCadastro: (resolucao: string) => boolean = () => false,
): readonly string[] {
  const messages: string[] = [];

  if (!classificacao.regraCalculoCodigo) {
    messages.push('Selecione a regra de cálculo da nota, no passo Fórmula.');
  }

  if (classificacaoUsaFormulaLocal(classificacao.regraCalculoCodigo)) {
    if (!classificacao.regraArredondamentoCodigo) {
      messages.push('Selecione a regra de arredondamento, no passo Fórmula.');
    }
    const casas = inteiro(classificacao.casasArredondamento);
    if (casas === null || casas <= 0) {
      messages.push(
        'Informe as casas decimais de arredondamento, maior que zero, no passo Fórmula.',
      );
    }
  }

  if (!classificacao.regraOrdemAlocacaoCodigo) {
    messages.push('Selecione a regra de ordem de alocação, no passo Fórmula.');
  }

  const nOpcoes = inteiro(classificacao.nOpcoesAlocacao);
  if (nOpcoes !== 1 && nOpcoes !== 2) {
    messages.push('Informe o número de opções de curso (1 ou 2), no passo Fórmula.');
  }

  // Por último porque é o último campo da tela: o resumo segue a ordem em que o operador os vê.
  const pendencia = pendenciaDaResolucao(classificacao, resolucaoForaDoCadastro);
  if (pendencia !== null) messages.push(TEXTO_DA_PENDENCIA_DA_RESOLUCAO[pendencia].resumo);

  return messages;
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

/**
 * O campo da recusa do servidor é o da resolução de Peso por Área. Compara o nome sem prefixo de
 * caminho (`$.`, `request.`) e sem caixa — a recusa do domínio e a do model binding nomeiam o mesmo
 * campo de formas diferentes.
 */
export function ehCampoDaResolucao(campo: string): boolean {
  return (campo.split('.').at(-1) ?? campo).toLowerCase() === 'resolucaopesoareaenem';
}
