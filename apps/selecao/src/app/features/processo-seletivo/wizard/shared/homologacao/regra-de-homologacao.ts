import type { CondicaoEmClausula } from '@uniplus/shared-inscricao/formulario';

import type {
  AlternativaDeHomologacao,
  CondicaoDeHomologacao,
  RegraDeHomologacao,
} from '../../modelos/homologacao.models';

/** Onde a condição está: a alternativa e a condição dentro dela, ambas a partir de zero. */
export interface PosicaoDaCondicao {
  readonly alternativa: number;
  readonly condicao: number;
}

/** A regra recém-declarada: sem resultado apontado e sem alternativa, que homologa toda inscrição enviada. */
export function regraNova(): RegraDeHomologacao {
  return { resultadoAtoCodigo: null, alternativas: [] };
}

/** A fase sem a regra de homologação. */
export function semRegra(): null {
  return null;
}

/** A condição recém-incluída: sem edição, sem motivo e sem enquadramento, para a pessoa preencher. */
export function condicaoNova(tipo: string): CondicaoDeHomologacao {
  return { tipo, edicaoDoExame: null, motivoDesfavoravelCodigo: null, enquadramento: [] };
}

export function comResultado(
  regra: RegraDeHomologacao,
  resultadoAtoCodigo: string | null,
): RegraDeHomologacao {
  return { ...regra, resultadoAtoCodigo };
}

/** A alternativa nasce com uma condição, porque a alternativa sem condição não se grava. */
export function comAlternativaIncluida(
  regra: RegraDeHomologacao,
  tipo: string,
): RegraDeHomologacao {
  return { ...regra, alternativas: [...regra.alternativas, { condicoes: [condicaoNova(tipo)] }] };
}

export function semAlternativa(regra: RegraDeHomologacao, alternativa: number): RegraDeHomologacao {
  if (!existe(regra.alternativas, alternativa)) return regra;
  return { ...regra, alternativas: regra.alternativas.filter((_, i) => i !== alternativa) };
}

export function comCondicaoIncluida(
  regra: RegraDeHomologacao,
  alternativa: number,
  tipo: string,
): RegraDeHomologacao {
  return naAlternativa(regra, alternativa, (atual) => ({
    condicoes: [...atual.condicoes, condicaoNova(tipo)],
  }));
}

/** A alternativa que perde a última condição deixa de existir. */
export function semCondicao(
  regra: RegraDeHomologacao,
  posicao: PosicaoDaCondicao,
): RegraDeHomologacao {
  if (!existeCondicao(regra, posicao)) return regra;
  const restantes = regra.alternativas[posicao.alternativa].condicoes.filter(
    (_, i) => i !== posicao.condicao,
  );
  if (restantes.length === 0) return semAlternativa(regra, posicao.alternativa);
  return naAlternativa(regra, posicao.alternativa, () => ({ condicoes: restantes }));
}

export function comTipoDaCondicao(
  regra: RegraDeHomologacao,
  posicao: PosicaoDaCondicao,
  tipo: string,
): RegraDeHomologacao {
  return comCondicaoTrocada(regra, posicao, { tipo });
}

export function comEdicaoDaCondicao(
  regra: RegraDeHomologacao,
  posicao: PosicaoDaCondicao,
  edicaoDoExame: number | null,
): RegraDeHomologacao {
  return comCondicaoTrocada(regra, posicao, { edicaoDoExame });
}

export function comMotivoDaCondicao(
  regra: RegraDeHomologacao,
  posicao: PosicaoDaCondicao,
  motivoDesfavoravelCodigo: string | null,
): RegraDeHomologacao {
  return comCondicaoTrocada(regra, posicao, { motivoDesfavoravelCodigo });
}

export function comEnquadramentoDaCondicao(
  regra: RegraDeHomologacao,
  posicao: PosicaoDaCondicao,
  enquadramento: readonly CondicaoEmClausula[],
): RegraDeHomologacao {
  return comCondicaoTrocada(regra, posicao, { enquadramento });
}

function existe(lista: readonly unknown[], indice: number): boolean {
  return Number.isInteger(indice) && indice >= 0 && indice < lista.length;
}

function existeCondicao(regra: RegraDeHomologacao, posicao: PosicaoDaCondicao): boolean {
  return (
    existe(regra.alternativas, posicao.alternativa) &&
    existe(regra.alternativas[posicao.alternativa].condicoes, posicao.condicao)
  );
}

/** A regra com a alternativa trocada; posição que não existe devolve a mesma regra. */
function naAlternativa(
  regra: RegraDeHomologacao,
  alternativa: number,
  troca: (atual: AlternativaDeHomologacao) => AlternativaDeHomologacao,
): RegraDeHomologacao {
  if (!existe(regra.alternativas, alternativa)) return regra;
  return {
    ...regra,
    alternativas: regra.alternativas.map((atual, i) => (i === alternativa ? troca(atual) : atual)),
  };
}

function comCondicaoTrocada(
  regra: RegraDeHomologacao,
  posicao: PosicaoDaCondicao,
  troca: Partial<CondicaoDeHomologacao>,
): RegraDeHomologacao {
  if (!existeCondicao(regra, posicao)) return regra;
  return naAlternativa(regra, posicao.alternativa, (atual) => ({
    condicoes: atual.condicoes.map((condicao, i) =>
      i === posicao.condicao ? { ...condicao, ...troca } : condicao,
    ),
  }));
}
