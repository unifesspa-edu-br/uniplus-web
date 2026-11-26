import { formarCodigoUnicoDoNome } from '@uniplus/shared-utils';

import { LIMITES_DO_FORMULARIO, REGRAS_INICIAIS } from './constantes';
import {
  ConteudoDoFormulario,
  ResultadoDaEdicao,
  TermoDisponivel,
  TermoDoFormulario,
} from './tipos';

/** Os termos em ordem. */
export function termosEmOrdem(conteudo: ConteudoDoFormulario): readonly TermoDoFormulario[] {
  return [...(conteudo.termos ?? [])].sort((a, b) => a.ordem - b.ordem);
}

/** Os termos que ainda podem ser exigidos: os que têm versão promovida e o formulário não exige. */
export function termosParaAcrescentar(
  conteudo: ConteudoDoFormulario,
  disponiveis: readonly TermoDisponivel[],
): readonly TermoDisponivel[] {
  const exigidos = new Set((conteudo.termos ?? []).map((termo) => termo.termo.termoId));
  return disponiveis.filter((termo) => termo.versoes.length > 0 && !exigidos.has(termo.termoId));
}

/**
 * Exige o termo na versão mais nova, com aceite obrigatório, depois dos demais. O código do termo no
 * formulário vem do nome, em caixa alta e sem acento, e não repete o de outro termo.
 */
export function acrescentarTermo(
  conteudo: ConteudoDoFormulario,
  termo: TermoDisponivel,
): ResultadoDaEdicao {
  const termos = termosEmOrdem(conteudo);
  const usados = new Set(termos.map((t) => t.codigo));
  const codigo = formarCodigoUnicoDoNome(termo.nome, 'TERMO', usados, LIMITES_DO_FORMULARIO.codigo);
  if (!codigo.ok) return recusaDoCodigoDoTermo(codigo.limite);
  return {
    ok: true,
    conteudo: { ...conteudo, termos: [...termos, termoNovo(termo, codigo.codigo, termos)] },
  };
}

function recusaDoCodigoDoTermo(limite: number): ResultadoDaEdicao {
  return {
    ok: false,
    recusa: `O código formado a partir do nome deste termo passaria de ${limite} caracteres, e o termo não pode ser exigido. O nome é definido no cadastro de termos de consentimento.`,
  };
}

function termoNovo(
  termo: TermoDisponivel,
  codigo: string,
  termos: readonly TermoDoFormulario[],
): TermoDoFormulario {
  return {
    codigo,
    // Depois da maior ordem gravada: a gravada pode ter buraco, e ordem repetida é recusada.
    ordem: Math.max(-1, ...termos.map((t) => t.ordem)) + 1,
    termo: { termoId: termo.termoId, versaoId: termo.versoes[0]?.versaoId ?? '' },
    regras: REGRAS_INICIAIS,
  };
}

/** Troca o termo pelo editado, sem mexer na ordem. */
export function comTermo(
  conteudo: ConteudoDoFormulario,
  editado: TermoDoFormulario,
): ConteudoDoFormulario {
  return {
    ...conteudo,
    termos: (conteudo.termos ?? []).map((termo) =>
      termo.codigo === editado.codigo ? editado : termo,
    ),
  };
}

/** Troca o termo de lugar com o vizinho; a ordem dos termos não depende de citação. */
export function moverTermo(
  conteudo: ConteudoDoFormulario,
  codigo: string,
  direcao: -1 | 1,
): ConteudoDoFormulario {
  const termos = [...termosEmOrdem(conteudo)];
  const indice = termos.findIndex((termo) => termo.codigo === codigo);
  const alvo = indice + direcao;
  if (indice < 0 || alvo < 0 || alvo >= termos.length) return conteudo;
  [termos[indice], termos[alvo]] = [termos[alvo], termos[indice]];
  return { ...conteudo, termos: termos.map((termo, posicao) => ({ ...termo, ordem: posicao })) };
}

export function removerTermo(conteudo: ConteudoDoFormulario, codigo: string): ConteudoDoFormulario {
  return {
    ...conteudo,
    termos: termosEmOrdem(conteudo)
      .filter((termo) => termo.codigo !== codigo)
      .map((termo, posicao) => ({ ...termo, ordem: posicao })),
  };
}
