import type { ExigenciasDoRascunho } from '../../processo-seletivo.models';

import { exigenciasLocalizadas } from './consulta-das-exigencias';
import { transformar } from './composicao-das-regras';

/**
 * O formulário da exigência diante dos que a fase responde: definido, a escolher, à espera de um
 * formulário que a fase ainda não tem, ou declarado para um formulário que a fase não responde mais.
 */
export type FormularioDaExigencia =
  | { readonly situacao: 'DEFINIDO'; readonly codigo: string }
  | { readonly situacao: 'AGUARDA_FORMULARIO' }
  | { readonly situacao: 'A_ESCOLHER' }
  | { readonly situacao: 'NAO_RESPONDIDO'; readonly declarada: string };

/**
 * O formulário em que o documento é apresentado. O declarado vale enquanto a fase o responde; sem
 * declaração, a fase de um formulário só o preenche. A fase que responde mais de um formulário pede
 * a escolha, e a que ainda não tem formulário deixa o documento à espera dele: o servidor exige o
 * formulário em todo documento exigido, e o documento só é gravado quando a fase passa a ter um.
 *
 * O declarado que a fase deixou de responder não é trocado por outro: o formulário diz de quem o
 * documento é cobrado — o da isenção só de quem pede isenção, o da inscrição de todo candidato —,
 * e reatribuí-lo mudaria a regra sem que ninguém a decidisse. Fica indefinido até o operador
 * escolher.
 */
export function formularioDaExigencia(
  declarada: string | null,
  atendidas: readonly string[],
): FormularioDaExigencia {
  if (atendidas.length === 0) return { situacao: 'AGUARDA_FORMULARIO' };
  if (declarada !== null) {
    return atendidas.includes(declarada)
      ? { situacao: 'DEFINIDO', codigo: declarada }
      : { situacao: 'NAO_RESPONDIDO', declarada };
  }
  return atendidas.length === 1
    ? { situacao: 'DEFINIDO', codigo: atendidas[0] }
    : { situacao: 'A_ESCOLHER' };
}

/**
 * O que falta para a exigência ter formulário, dito ao operador; `null` quando ela já tem ou quando
 * a fase ainda não tem formulário, que a tela avisa sem recusar. O servidor recusa a escolha que a
 * fase dividida pede e o formulário que a fase não responde.
 */
export function faltaOFormulario(
  declarada: string | null,
  atendidas: readonly string[],
): string | null {
  const formulario = formularioDaExigencia(declarada, atendidas);
  switch (formulario.situacao) {
    case 'DEFINIDO':
    case 'AGUARDA_FORMULARIO':
      return null;
    case 'A_ESCOLHER':
      return 'Escolha em que formulário o candidato apresenta este documento.';
    case 'NAO_RESPONDIDO':
      return `O formulário ${formulario.declarada} não é respondido nesta fase; escolha o formulário.`;
  }
}

/**
 * O código do formulário que o comando leva: o definido, ou o declarado que a fase não responde
 * mais — nunca outro no lugar dele; o servidor o recusa, e a recusa diz o que a conferência da
 * tela já diz. Só vale com o conjunto completo: `null` fica para a escolha que a fase dividida
 * pede, que o servidor recusa, e a fase sem formulário nem chega ao envio (ver
 * `aguardaFormulario`).
 */
export function codigoEnviado(
  declarada: string | null,
  atendidas: readonly string[],
): string | null {
  const formulario = formularioDaExigencia(declarada, atendidas);
  switch (formulario.situacao) {
    case 'DEFINIDO':
      return formulario.codigo;
    case 'A_ESCOLHER':
    case 'AGUARDA_FORMULARIO':
      return null;
    case 'NAO_RESPONDIDO':
      return formulario.declarada;
  }
}

/** Se a fase ainda não tem formulário em que o documento possa ser apresentado. */
export function aguardaFormulario(atendidas: readonly string[]): boolean {
  return atendidas.length === 0;
}

/** Os itens de uma fase que o candidato apresenta num mesmo formulário; `null` é o que ainda não tem formulário. */
export interface ItensDoFormulario<T> {
  readonly codigo: string | null;
  readonly itens: readonly T[];
}

/**
 * Os itens de uma fase agrupados pelo formulário efetivo, na ordem dos formulários que a fase
 * responde, e os que ainda não têm formulário por último. A fase que responde um formulário só, ou
 * nenhum, não se divide: um grupo leva todos.
 */
export function agrupadosPorFormulario<T>(
  itens: readonly T[],
  codigoDe: (item: T) => string | null,
  atendidas: readonly string[],
): readonly ItensDoFormulario<T>[] {
  if (atendidas.length <= 1) return [{ codigo: atendidas[0] ?? null, itens }];

  return [...atendidas, null]
    .map((codigo) => ({
      codigo,
      itens: itens.filter((item) => codigoDe(item) === codigo),
    }))
    .filter((grupo) => grupo.itens.length > 0);
}

/**
 * Declara o formulário da exigência de (documento, fase), e de toda a regra principal que a contém.
 *
 * As alternativas de um grupo se satisfazem num bloco de comprovação só, e o servidor recusa o
 * grupo com documentos de formulários diferentes: o formulário é da regra principal, e os itens o herdam.
 * Trocá-lo só na regra de documento editada deixaria o grupo dividido entre dois formulários.
 */
export function comFormularioDaExigencia(
  exigencias: ExigenciasDoRascunho,
  identificadorNoRascunho: string,
  formularioCodigo: string | null,
): ExigenciasDoRascunho {
  const posicao = posicaoDaExigencia(exigencias, identificadorNoRascunho);
  if (posicao === -1) return exigencias;

  const regras = regrasComFormulario(exigencias.regrasDeComprovacao, posicao, formularioCodigo);
  return { ...exigencias, regrasDeComprovacao: regras };
}

function regrasComFormulario(
  regras: ExigenciasDoRascunho['regrasDeComprovacao'],
  posicao: number,
  formularioCodigo: string | null,
): ExigenciasDoRascunho['regrasDeComprovacao'] {
  return regras.flatMap((regra, indice) =>
    indice === posicao
      ? transformar([regra], (documento) => ({ ...documento, formularioCodigo }))
      : [regra],
  );
}

function posicaoDaExigencia(exigencias: ExigenciasDoRascunho, identificador: string): number {
  return exigencias.regrasDeComprovacao.findIndex((regra) =>
    exigenciasLocalizadas({ regrasDeComprovacao: [regra], emTodasAsFases: [] }).some(
      (item) => item.identificadorNoRascunho === identificador,
    ),
  );
}

/** Um formulário que a fase responde, como o seletor o nomeia. */
export interface FormularioDaFase {
  readonly codigo: string;
  readonly rotulo: string;
}

/** Os formulários que a escolha oferece, como o seletor os nomeia. */
export function formulariosEscolhiveis(
  atendidas: readonly FormularioDaFase[],
): readonly { readonly valor: string; readonly rotulo: string }[] {
  return atendidas.map(({ codigo, rotulo }) => ({ valor: codigo, rotulo: `Formulário ${rotulo}` }));
}
