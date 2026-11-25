import { comparaComLista } from '../../formulario-do-candidato/interpretador/predicado';
import { FatoEscolhivel } from './fatos-escolhiveis';

/** Um operador (ou resposta) oferecido para um fato, com a leitura que a tela faz dele. */
export interface OpcaoDeValor {
  readonly valor: string;
  readonly rotulo: string;
}

/** A tripla que compara um fato do candidato a um valor em texto JSON. */
export interface CondicaoDeFato {
  readonly fato: string;
  readonly operador: string;
  readonly valor: string;
}

/** Os dois valores do domínio booleano, como o wire os escreve. */
export const VALOR_VERDADEIRO = 'true';
export const VALOR_FALSO = 'false';

/**
 * O que o operador escolhe num fato booleano. São duas opções fechadas, e não texto livre: um
 * campo de texto aqui aceitaria "Sim" e gravaria o oposto do que foi digitado.
 */
export const RESPOSTAS_BOOLEANAS: readonly OpcaoDeValor[] = [
  { valor: VALOR_VERDADEIRO, rotulo: 'Sim' },
  { valor: VALOR_FALSO, rotulo: 'Não' },
];

/** O valor escalar da condição, como texto — vazio quando ela ainda não tem valor. */
export function valorEscalarDe(condicao: CondicaoDeFato): string {
  const valor = interpretar(condicao.valor);
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'number' || typeof valor === 'boolean') return condicao.valor.trim();
  // Texto que não é JSON vale por si — é assim que o servidor o recebe, e é o que preserva o
  // que está sendo digitado antes de virar número completo.
  if (valor === undefined && condicao.valor !== '') return condicao.valor;
  return '';
}

/** Os valores da condição de lista — vazio quando ela ainda não tem nenhum. */
export function valoresDeListaDe(condicao: CondicaoDeFato): readonly string[] {
  const valor = interpretar(condicao.valor);
  if (!Array.isArray(valor)) return [];
  return valor.filter((item): item is string => typeof item === 'string');
}

/**
 * A condição com o valor trocado, escrito na forma JSON que o domínio de cada fato exige:
 * texto entre aspas no categórico, número cru no numérico, `true`/`false` no booleano.
 */
export function comValorEscalar<T extends CondicaoDeFato>(
  condicao: T,
  fato: FatoEscolhivel,
  valor: string,
): T {
  return { ...condicao, valor: valor === '' ? '' : valorNoWire(fato, valor) };
}

/**
 * No numérico, o que foi escrito é guardado como veio, e a conferência acusa o que o domínio
 * recusa — ele só aceita inteiro. Truncar aqui gravava um número diferente do que ficava na tela:
 * quem digitava 1412.50 via 1412.50 e gravava 1412, sem nada dizer.
 */
function valorNoWire(fato: FatoEscolhivel, valor: string): string {
  switch (fato.tipoDominio) {
    case 'BOOLEANO':
      return valorBooleano(valor);
    case 'NUMERICO':
      return valor.trim();
    default:
      return JSON.stringify(valor);
  }
}

/**
 * Só os dois tokens do domínio são aceitos. Qualquer outra coisa volta ao estado sem valor, que a
 * conferência acusa — tratar o não reconhecido como "não" gravaria silenciosamente o oposto do que
 * foi escrito, e o servidor aceitaria, porque é booleano JSON válido.
 */
function valorBooleano(valor: string): string {
  return valor === VALOR_VERDADEIRO || valor === VALOR_FALSO ? valor : '';
}

/** A condição de lista com os valores trocados. Lista vazia volta ao estado sem valor. */
export function comValoresDeLista<T extends CondicaoDeFato>(
  condicao: T,
  valores: readonly string[],
): T {
  return { ...condicao, valor: valores.length === 0 ? '' : JSON.stringify(valores) };
}

/**
 * A condição com o operador trocado. O valor é PRESERVADO quando as duas formas coincidem —
 * trocar "é" por "não é" não deveria apagar o valor escolhido —, e convertido quando não: de
 * escalar para lista de um item, e da lista de volta para o primeiro item dela.
 */
export function comOperador<T extends CondicaoDeFato>(
  condicao: T,
  fato: FatoEscolhivel,
  operador: string,
): T {
  const trocada = { ...condicao, operador };
  if (comparaComLista(operador) === comparaComLista(condicao.operador)) return trocada;
  return comparaComLista(operador) ? comoLista(trocada) : comoEscalar(trocada, fato);
}

function comoLista<T extends CondicaoDeFato>(condicao: T): T {
  const escalar = valorEscalarDe(condicao);
  return comValoresDeLista(condicao, escalar === '' ? [] : [escalar]);
}

function comoEscalar<T extends CondicaoDeFato>(condicao: T, fato: FatoEscolhivel): T {
  const [primeiro] = valoresDeListaDe(condicao);
  return comValorEscalar(condicao, fato, primeiro ?? '');
}

/**
 * O valor da condição como JSON, ou `undefined` quando ele ainda não foi escrito ou não é
 * JSON. O chamador que lê escalar trata o texto cru como o próprio valor — é o que o servidor
 * faz ao receber, e é o que faz um número sendo digitado sobreviver ao caractere que ainda
 * não o completa.
 */
export function interpretar(valor: string): unknown {
  if (valor === '') return undefined;
  try {
    return JSON.parse(valor);
  } catch {
    return undefined;
  }
}
