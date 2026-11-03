import type { ExigenciasDoRascunho } from '../../processo-seletivo.models';
import { nomeDaFinalidade } from '../../steps/formulario/formularios-por-finalidade';

import { documentosDe } from './consulta-das-exigencias';
import { transformar } from './exigencias-documentais';

/**
 * O formulário da exigência diante dos que a fase responde: definido — um formulário, ou nenhum na
 * fase que não responde formulário —, a escolher, ou declarado para um formulário que a fase não
 * responde mais.
 */
export type FormularioDaExigencia =
  | { readonly situacao: 'DEFINIDO'; readonly finalidade: string | null }
  | { readonly situacao: 'A_ESCOLHER' }
  | { readonly situacao: 'NAO_RESPONDIDO'; readonly declarada: string };

/**
 * O formulário em que o documento é apresentado. O declarado vale enquanto a fase o responde; sem
 * declaração, a fase de um formulário só o preenche, e a que não responde nenhum deixa o documento
 * fora de formulário. A fase que divide inscrição e isenção pede a escolha.
 *
 * O declarado que a fase deixou de responder não é trocado por outro: o formulário diz de quem o
 * documento é cobrado — o da isenção só de quem pede isenção, o da inscrição de todo candidato —,
 * e reatribuí-lo mudaria a regra sem que ninguém a decidisse. Fica indefinido até o operador
 * escolher.
 */
export function finalidadeDaExigencia(
  declarada: string | null,
  atendidas: readonly string[],
): FormularioDaExigencia {
  if (declarada !== null) {
    return atendidas.includes(declarada)
      ? { situacao: 'DEFINIDO', finalidade: declarada }
      : { situacao: 'NAO_RESPONDIDO', declarada };
  }
  if (atendidas.length === 0) return { situacao: 'DEFINIDO', finalidade: null };
  return atendidas.length === 1
    ? { situacao: 'DEFINIDO', finalidade: atendidas[0] }
    : { situacao: 'A_ESCOLHER' };
}

/**
 * O que falta para a exigência ter formulário, dito ao operador; `null` quando ela já tem. O servidor
 * recusa as duas faltas: a escolha que a fase dividida pede e o formulário que a fase não responde.
 */
export function faltaOFormulario(
  declarada: string | null,
  atendidas: readonly string[],
): string | null {
  const formulario = finalidadeDaExigencia(declarada, atendidas);
  switch (formulario.situacao) {
    case 'DEFINIDO':
      return null;
    case 'A_ESCOLHER':
      return 'Escolha em que formulário o candidato apresenta este documento.';
    case 'NAO_RESPONDIDO':
      return `O formulário de ${nomeDaFinalidade(formulario.declarada)} não é respondido nesta fase; escolha o formulário.`;
  }
}

/**
 * A finalidade que o comando leva: a definida, ou a declarada que a fase não responde mais — nunca
 * outra no lugar dela; o servidor a recusa, e a recusa diz o que a conferência da tela já diz.
 */
export function finalidadeEnviada(
  declarada: string | null,
  atendidas: readonly string[],
): string | null {
  const formulario = finalidadeDaExigencia(declarada, atendidas);
  switch (formulario.situacao) {
    case 'DEFINIDO':
      return formulario.finalidade;
    case 'A_ESCOLHER':
      return null;
    case 'NAO_RESPONDIDO':
      return formulario.declarada;
  }
}

/** Os itens de uma fase que o candidato apresenta num mesmo formulário; `null` é o que ainda não tem formulário. */
export interface ItensDoFormulario<T> {
  readonly finalidade: string | null;
  readonly itens: readonly T[];
}

/**
 * Os itens de uma fase agrupados pelo formulário efetivo, na ordem dos formulários que a fase
 * responde, e os que ainda não têm formulário por último. A fase que responde um formulário só, ou
 * nenhum, não se divide: um grupo leva todos.
 */
export function agrupadosPorFormulario<T>(
  itens: readonly T[],
  finalidadeDe: (item: T) => string | null,
  atendidas: readonly string[],
): readonly ItensDoFormulario<T>[] {
  if (atendidas.length <= 1) return [{ finalidade: atendidas[0] ?? null, itens }];

  return [...atendidas, null]
    .map((finalidade) => ({
      finalidade,
      itens: itens.filter((item) => finalidadeDe(item) === finalidade),
    }))
    .filter((grupo) => grupo.itens.length > 0);
}

/**
 * Declara o formulário da exigência de (documento, fase), e de toda a árvore de raiz que a contém.
 *
 * As alternativas de um grupo se satisfazem num bloco de comprovação só, e o servidor recusa o
 * grupo com documentos de formulários diferentes: o formulário é da raiz, e os filhos o herdam.
 * Trocá-lo só na folha editada deixaria o grupo dividido entre dois formulários.
 */
export function comFinalidade(
  exigencias: ExigenciasDoRascunho,
  tipoDocumentoId: string,
  faseCodigo: string,
  finalidade: string | null,
): ExigenciasDoRascunho {
  // A mesma declaração que `comExigencia` edita: a primeira que casa, na ordem da árvore.
  const posicao = exigencias.raizes.findIndex((raiz) =>
    documentosDe([raiz]).some(
      (documento) =>
        documento.tipoDocumentoId === tipoDocumentoId && documento.faseCodigo === faseCodigo,
    ),
  );
  if (posicao === -1) return exigencias;

  return {
    ...exigencias,
    raizes: exigencias.raizes.flatMap((raiz, indice) =>
      indice === posicao
        ? transformar([raiz], (documento) => ({ ...documento, finalidade }))
        : [raiz],
    ),
  };
}

/** A opção que deixa o documento fora de formulário, na fase que não responde nenhum. */
export const SEM_FORMULARIO = 'SEM_FORMULARIO';

/**
 * Os formulários que a escolha oferece, como o seletor os nomeia. Na fase que não responde
 * formulário nenhum, a escolha só aparece para desfazer um formulário declarado antes, e a saída
 * é deixar o documento fora de formulário.
 */
export function formulariosEscolhiveis(
  atendidas: readonly string[],
): readonly { readonly valor: string; readonly rotulo: string }[] {
  return atendidas.length === 0
    ? [{ valor: SEM_FORMULARIO, rotulo: 'Nenhum: a fase não responde formulário' }]
    : atendidas.map((finalidade) => ({
        valor: finalidade,
        rotulo: `Formulário de ${nomeDaFinalidade(finalidade)}`,
      }));
}

/**
 * Se a escolha do formulário aparece: na fase que responde algum, e em qualquer fase enquanto o
 * formulário declarado não é respondido nela — escondê-la deixaria a falta sem o campo que a resolve.
 */
export function mostraFormulario(declarada: string | null, atendidas: readonly string[]): boolean {
  return atendidas.length > 0 || faltaOFormulario(declarada, atendidas) !== null;
}
