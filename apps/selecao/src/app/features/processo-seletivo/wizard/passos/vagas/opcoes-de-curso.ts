import type { ProblemDetails } from '@uniplus/shared-core/http';

/** Quantos cursos o candidato escolhe na inscrição, com o texto do seletor e da consulta. */
export const OPCOES_DE_CURSO = [
  { valor: '1', rotulo: '1 opção' },
  { valor: '2', rotulo: '2 opções' },
] as const;

/** O mesmo texto que a API devolve ao recusar: o operador lê uma frase só, venha de onde vier. */
export const TEXTO_OPCOES_ACIMA_DAS_OFERTAS =
  'Com 2 opções de curso, cadastre pelo menos dois cursos.';

/** A ajuda do campo: o que o número significa e a consequência para o quadro de cursos. */
export const AJUDA_DAS_OPCOES =
  'Quantos cursos o candidato escolhe na inscrição. Com 2 opções, cadastre pelo menos dois cursos.';

export const TEXTO_OPCOES_NAO_DECLARADAS = 'Informe o número de opções de curso.';

const CODIGO_ACIMA_DAS_OFERTAS =
  'uniplus.selecao.processo_seletivo.opcoes_de_curso_acima_das_ofertas';

/** O rótulo do número escolhido, ou `null` enquanto não há escolha. */
export function rotuloDasOpcoes(numero: string): string | null {
  return OPCOES_DE_CURSO.find((opcao) => opcao.valor === numero)?.rotulo ?? null;
}

/**
 * O que impede de gravar o número de opções, ou `null`. Com duas opções o candidato precisa de
 * dois cursos para escolher; a API recusa o mesmo caso, e conferir aqui poupa a ida e volta.
 */
export function erroDasOpcoes(numero: string, quantidadeDeOfertas: number): string | null {
  if (numero === '') return TEXTO_OPCOES_NAO_DECLARADAS;
  if (numero === '2' && quantidadeDeOfertas < 2) return TEXTO_OPCOES_ACIMA_DAS_OFERTAS;
  return null;
}

/** A recusa da API por número de opções acima das ofertas, no campo `numero` ou sem campo. */
export function recusadoPorOpcoesAcimaDasOfertas(problem: ProblemDetails): boolean {
  return (
    problem.code === CODIGO_ACIMA_DAS_OFERTAS ||
    (problem.errors ?? []).some((erro) => erro.code === CODIGO_ACIMA_DAS_OFERTAS)
  );
}

/**
 * Qual gravação sai primeiro. O servidor recusa o número maior que a quantidade de ofertas já
 * gravadas, e a distribuição com menos ofertas que o número já gravado. Reduzir cursos e opções
 * juntos só passa baixando o número antes; nos demais casos a distribuição vai primeiro, o que
 * também cobre a primeira gravação e o aumento de 1 para 2 opções com 2 cursos.
 */
export function numeroDeOpcoesPrimeiro(
  numeroGravado: number | null,
  quantidadeDeOfertasNova: number,
): boolean {
  return numeroGravado !== null && quantidadeDeOfertasNova < numeroGravado;
}
