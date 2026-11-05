import { FINALIDADE_INSCRICAO, OBRIGATORIEDADE_SEMPRE } from './constantes';
import { ItemDoFormulario, PredicadoNoWire } from './tipos';

/** Os tipos de campo que o impedimento admite (`Impedimento.CabeNoCampo`). */
const CAMPOS_COM_IMPEDIMENTO = new Set([
  'BOOLEANO',
  'NUMERO',
  'SELECAO_UNICA',
  'SELECAO_MULTIPLA',
  'MUNICIPIO',
]);

/**
 * Se o campo pode ter impedimento: só na inscrição — ele impede a inscrição —, num tipo de campo que
 * o admite e quando a condição consegue citar a resposta do próprio campo, que toda alternativa do
 * impedimento cita. A seleção de valores dinâmicos não entra: o editor de condições não tem a lista
 * dela para oferecer. O município entra quando há a busca de onde a condição tira o valor.
 */
export function impedimentoCabe(
  finalidade: string,
  tipoRenderizacao: string,
  proprioFatoCitavel: boolean,
): boolean {
  return (
    finalidade === FINALIDADE_INSCRICAO &&
    CAMPOS_COM_IMPEDIMENTO.has(tipoRenderizacao) &&
    proprioFatoCitavel
  );
}

/**
 * O item com o impedimento ligado: a condição inicial é sobre o próprio campo, e o campo fica
 * obrigatório sempre na mesma edição — em branco, o impedimento nunca se cumpriria (UNI-REQ-0074).
 */
export function comImpedimento(item: ItemDoFormulario, quando: PredicadoNoWire): ItemDoFormulario {
  return {
    ...item,
    impedimento: { quando, mensagem: item.impedimento?.mensagem ?? '' },
    obrigatoriedade: OBRIGATORIEDADE_SEMPRE,
    predicadoObrigatoriedade: null,
  };
}

/** Se alguma alternativa do impedimento deixou de citar o próprio campo — a API recusa (`ImpedimentoSemOProprioCampo`). */
export function alternativaSemOProprioCampo(quando: PredicadoNoWire, fatoCodigo: string): boolean {
  return (
    (quando ?? []).length === 0 ||
    (quando ?? []).some((clausula) => !clausula.some((condicao) => condicao.fato === fatoCodigo))
  );
}
