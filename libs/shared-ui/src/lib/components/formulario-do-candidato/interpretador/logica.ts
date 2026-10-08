import type { ValorJson } from './regras-do-formulario';

/**
 * A lógica de três valores das regras: o que aparece, é obrigatório ou impede pode ser verdadeiro,
 * falso ou ainda indeterminado, enquanto falta a resposta de que depende.
 */
export const VERDADEIRO = 'VERDADEIRO';
export const FALSO = 'FALSO';
export const INDETERMINADO = 'INDETERMINADO';
export type Ternario = typeof VERDADEIRO | typeof FALSO | typeof INDETERMINADO;

/** E de três valores: o falso decide mesmo diante do indeterminado. */
export function e(a: Ternario, b: Ternario): Ternario {
  if (a === FALSO || b === FALSO) return FALSO;
  return a === INDETERMINADO || b === INDETERMINADO ? INDETERMINADO : VERDADEIRO;
}

export function comoTernario(atende: boolean): Ternario {
  return atende ? VERDADEIRO : FALSO;
}

/**
 * O estado de um fato: resolvido com valor; indeterminado enquanto se espera a resposta; não aplicável
 * quando o campo não aparece; não informado quando o opcional ficou em branco numa seção concluída.
 */
export const RESOLVIDO = 'RESOLVIDO';
export const NAO_APLICAVEL = 'NAO_APLICAVEL';
export const NAO_INFORMADO = 'NAO_INFORMADO';
export type EstadoDoFato =
  | typeof RESOLVIDO
  | typeof INDETERMINADO
  | typeof NAO_APLICAVEL
  | typeof NAO_INFORMADO;

export interface FatoResolvido {
  readonly estado: EstadoDoFato;
  readonly valor?: ValorJson;
}

export type Fatos = ReadonlyMap<string, FatoResolvido>;

export const FATO_INDETERMINADO: FatoResolvido = { estado: INDETERMINADO };
export const FATO_NAO_APLICAVEL: FatoResolvido = { estado: NAO_APLICAVEL };
export const FATO_NAO_INFORMADO: FatoResolvido = { estado: NAO_INFORMADO };

export function resolvido(valor: ValorJson): FatoResolvido {
  return { estado: RESOLVIDO, valor };
}

/** A forma de um valor JSON, como o avaliador da API a distingue. */
export type FormaDoValor = 'texto' | 'numero' | 'booleano' | 'lista' | 'objeto' | 'nulo';

export function formaDe(valor: ValorJson | undefined): FormaDoValor {
  if (valor === null || valor === undefined) return 'nulo';
  if (Array.isArray(valor)) return 'lista';
  switch (typeof valor) {
    case 'string':
      return 'texto';
    case 'number':
      return 'numero';
    case 'boolean':
      return 'booleano';
    default:
      return 'objeto';
  }
}

/**
 * Sem resposta: nulo, texto em branco ou lista vazia. Tratar o branco como valor faria uma condição
 * DIFERENTE ou NAO_EM ser satisfeita por quem não respondeu.
 */
export function estaVazia(resposta: ValorJson | undefined): boolean {
  switch (formaDe(resposta)) {
    case 'nulo':
      return true;
    case 'texto':
      return (resposta as string).trim() === '';
    case 'lista':
      return (resposta as readonly ValorJson[]).length === 0;
    default:
      return false;
  }
}

/**
 * Os códigos escolhidos: o texto de uma resposta escalar, ou os textos de uma lista; nulo quando a
 * resposta não tem essa forma.
 */
export function codigosDa(resposta: ValorJson | undefined): readonly string[] | null {
  if (typeof resposta === 'string') return [resposta];
  if (!Array.isArray(resposta)) return null;
  return resposta.every((item) => typeof item === 'string')
    ? (resposta as readonly string[])
    : null;
}
