import { codigoDoNome, codigoLivre } from './codigos';
import { OBRIGATORIEDADE_SEMPRE } from './constantes';
import { ConteudoDoFormulario, TermoDisponivel, TermoDoFormulario } from './tipos';

/** Os termos em ordem. */
export function termosEmOrdem(conteudo: ConteudoDoFormulario): readonly TermoDoFormulario[] {
  return [...(conteudo.termos ?? [])].sort((a, b) => a.ordem - b.ordem);
}

/** Os termos que ainda podem ser exigidos: os que têm versão promovida e o formulário não exige. */
export function termosParaAcrescentar(
  conteudo: ConteudoDoFormulario,
  disponiveis: readonly TermoDisponivel[],
): readonly TermoDisponivel[] {
  const exigidos = new Set((conteudo.termos ?? []).map((termo) => termo.termoId));
  return disponiveis.filter((termo) => termo.versoes.length > 0 && !exigidos.has(termo.termoId));
}

/**
 * Exige o termo na versão mais nova, com aceite obrigatório, depois dos demais. O código do termo no
 * formulário vem do nome, em caixa alta e sem acento, e não repete o de outro termo.
 */
export function acrescentarTermo(
  conteudo: ConteudoDoFormulario,
  termo: TermoDisponivel,
): ConteudoDoFormulario {
  const termos = termosEmOrdem(conteudo);
  const novo: TermoDoFormulario = {
    codigo: codigoLivre(codigoDoNome(termo.nome, 'TERMO'), new Set(termos.map((t) => t.codigo))),
    // Depois da maior ordem gravada: a gravada pode ter buraco, e ordem repetida é recusada.
    ordem: Math.max(-1, ...termos.map((t) => t.ordem)) + 1,
    termoId: termo.termoId,
    versaoId: termo.versoes[0]?.versaoId ?? '',
    exibicao: null,
    obrigatoriedade: OBRIGATORIEDADE_SEMPRE,
    predicadoObrigatoriedade: null,
  };
  return { ...conteudo, termos: [...termos, novo] };
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
