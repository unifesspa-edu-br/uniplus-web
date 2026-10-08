import {
  FALSO,
  type Fatos,
  formaDe,
  INDETERMINADO,
  NAO_APLICAVEL,
  NAO_INFORMADO,
  RESOLVIDO,
  type Ternario,
  VERDADEIRO,
  comoTernario,
} from './logica';
import type { ValorJson } from './regras-do-formulario';

/** Os operadores de uma condição. DIFERENTE e NAO_EM são a negação de IGUAL e EM. */
export const OPERADORES = [
  'IGUAL',
  'DIFERENTE',
  'EM',
  'NAO_EM',
  'MAIOR_IGUAL',
  'MENOR_IGUAL',
] as const;
export type Operador = (typeof OPERADORES)[number];

export function ehOperador(token: string): token is Operador {
  return (OPERADORES as readonly string[]).includes(token);
}

export function comparaComLista(operador: Operador): boolean {
  return operador === 'EM' || operador === 'NAO_EM';
}

export interface Condicao {
  readonly fato: string;
  readonly operador: Operador;
  readonly valor: ValorJson;
}

/** Um predicado lido: o OU das cláusulas, cada uma o E das condições. Sem cláusula, é falso. */
export interface Predicado {
  readonly clausulas: readonly (readonly Condicao[])[];
}

export function fatosCitadosPor(predicado: Predicado | null): readonly string[] {
  if (!predicado) return [];
  return [...new Set(predicado.clausulas.flatMap((clausula) => clausula.map((c) => c.fato)))];
}

/** OU de três valores sobre as cláusulas: verdadeiro se alguma é; senão indeterminado se alguma é. */
export function avaliarPredicado(predicado: Predicado, fatos: Fatos): Ternario {
  let algumaIndeterminada = false;
  for (const clausula of predicado.clausulas) {
    const resultado = avaliarClausula(clausula, fatos);
    if (resultado === VERDADEIRO) return VERDADEIRO;
    if (resultado === INDETERMINADO) algumaIndeterminada = true;
  }
  return algumaIndeterminada ? INDETERMINADO : FALSO;
}

/** O predicado opcional: sem condição, vale sempre. */
export function avaliarOuVerdadeiro(predicado: Predicado | null, fatos: Fatos): Ternario {
  return predicado ? avaliarPredicado(predicado, fatos) : VERDADEIRO;
}

/**
 * E de três valores sobre as condições. A condição sobre fato não aplicável é falsa em definitivo: a
 * exigência não se aplica, em vez de ficar pendente esperando um valor que não virá.
 */
function avaliarClausula(clausula: readonly Condicao[], fatos: Fatos): Ternario {
  let algumaIndeterminada = false;
  for (const condicao of clausula) {
    const resultado = avaliarCondicao(condicao, fatos);
    if (resultado === FALSO || resultado === NAO_APLICAVEL) return FALSO;
    if (resultado === INDETERMINADO) algumaIndeterminada = true;
  }
  return algumaIndeterminada ? INDETERMINADO : VERDADEIRO;
}

/**
 * Uma condição isolada. O estado do fato vale para todo operador, inclusive os de negação: a negação
 * inverte um valor, nunca a inaplicabilidade nem a falta de informação. O opcional em branco não
 * satisfaz condição alguma, nem "diferente de X". Valor de forma que o operador não compara fica
 * indeterminado, nunca falso em silêncio.
 */
function avaliarCondicao(condicao: Condicao, fatos: Fatos): Ternario | typeof NAO_APLICAVEL {
  const fato = fatos.get(condicao.fato);
  if (!fato) return INDETERMINADO;
  if (fato.estado === NAO_APLICAVEL) return NAO_APLICAVEL;
  if (fato.estado === NAO_INFORMADO) return FALSO;
  if (fato.estado !== RESOLVIDO || fato.valor === undefined || fato.valor === null)
    return INDETERMINADO;

  const negar = condicao.operador === 'DIFERENTE' || condicao.operador === 'NAO_EM';
  const base: Operador =
    condicao.operador === 'DIFERENTE'
      ? 'IGUAL'
      : condicao.operador === 'NAO_EM'
        ? 'EM'
        : condicao.operador;
  const resultado = avaliarOperador(base, fato.valor, condicao.valor);
  if (!negar || resultado === INDETERMINADO) return resultado;
  return resultado === VERDADEIRO ? FALSO : VERDADEIRO;
}

/**
 * Os operadores positivos. Sobre o fato de vários valores, IGUAL é pertinência do valor configurado no
 * conjunto, e EM é interseção não vazia com a lista configurada.
 */
function avaliarOperador(
  operador: Operador,
  candidato: ValorJson,
  configurado: ValorJson,
): Ternario {
  if (Array.isArray(candidato)) {
    switch (operador) {
      case 'IGUAL':
        return comoTernario(candidato.some((item) => valoresIguais(item, configurado)));
      case 'EM':
        return comoTernario(
          (configurado as readonly ValorJson[]).some((item) =>
            candidato.some((dele) => valoresIguais(dele, item)),
          ),
        );
      default:
        return INDETERMINADO;
    }
  }

  switch (operador) {
    case 'IGUAL':
      return compararIgualdade(candidato, configurado);
    case 'EM':
      return typeof candidato === 'string'
        ? comoTernario(
            (configurado as readonly ValorJson[]).some((item) => valoresIguais(candidato, item)),
          )
        : INDETERMINADO;
    case 'MAIOR_IGUAL':
      return compararNumerico(candidato, configurado, (comparacao) => comparacao >= 0);
    case 'MENOR_IGUAL':
      return compararNumerico(candidato, configurado, (comparacao) => comparacao <= 0);
    default:
      return INDETERMINADO;
  }
}

/** Igualdade de três valores: formas diferentes não se comparam e ficam indeterminadas. */
function compararIgualdade(candidato: ValorJson, configurado: ValorJson): Ternario {
  const forma = formaDe(candidato);
  if (forma !== formaDe(configurado)) return INDETERMINADO;
  return forma === 'texto' || forma === 'numero' || forma === 'booleano'
    ? comoTernario(candidato === configurado)
    : INDETERMINADO;
}

function valoresIguais(candidato: ValorJson, configurado: ValorJson): boolean {
  const forma = formaDe(candidato);
  return (
    forma === formaDe(configurado) &&
    (forma === 'texto' || forma === 'numero' || forma === 'booleano') &&
    candidato === configurado
  );
}

function compararNumerico(
  candidato: ValorJson,
  configurado: ValorJson,
  satisfaz: (comparacao: number) => boolean,
): Ternario {
  if (typeof candidato !== 'number' || typeof configurado !== 'number') return INDETERMINADO;
  return comoTernario(satisfaz(Math.sign(candidato - configurado)));
}
