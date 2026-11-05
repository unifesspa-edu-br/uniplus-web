import { FatoEscolhivel } from './fatos-escolhiveis';

/** Os operadores do predicado, nos tokens canônicos do wire. */
export const OPERADOR_IGUAL = 'IGUAL';
export const OPERADOR_DIFERENTE = 'DIFERENTE';
export const OPERADOR_EM = 'EM';
export const OPERADOR_NAO_EM = 'NAO_EM';
export const OPERADOR_MAIOR_IGUAL = 'MAIOR_IGUAL';
export const OPERADOR_MENOR_IGUAL = 'MENOR_IGUAL';

/** Um operador (ou resposta) oferecido para um fato, com a leitura que a tela faz dele. */
export interface OperadorEscolhivel {
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
export const RESPOSTAS_BOOLEANAS: readonly OperadorEscolhivel[] = [
  { valor: VALOR_VERDADEIRO, rotulo: 'Sim' },
  { valor: VALOR_FALSO, rotulo: 'Não' },
];

/**
 * Os operadores que o domínio do fato admite.
 *
 * "Não é" acompanha "é" em todo domínio; "é um de" e "não é nenhum de" só nos categóricos, que
 * são os únicos com lista de valores. A diferença entre "não é feminino" e "é masculino" é
 * real e importa: a primeira alcança também quem declarou intersexo.
 */
export function operadoresDoFato(fato: FatoEscolhivel): readonly OperadorEscolhivel[] {
  switch (fato.tipoDominio) {
    case 'BOOLEANO':
      return [
        { valor: OPERADOR_IGUAL, rotulo: 'é' },
        { valor: OPERADOR_DIFERENTE, rotulo: 'não é' },
      ];
    case 'NUMERICO':
      return [
        { valor: OPERADOR_IGUAL, rotulo: 'é igual a' },
        { valor: OPERADOR_DIFERENTE, rotulo: 'é diferente de' },
        { valor: OPERADOR_MAIOR_IGUAL, rotulo: 'é maior ou igual a' },
        { valor: OPERADOR_MENOR_IGUAL, rotulo: 'é menor ou igual a' },
      ];
    default:
      return [
        { valor: OPERADOR_IGUAL, rotulo: 'é' },
        { valor: OPERADOR_DIFERENTE, rotulo: 'não é' },
        { valor: OPERADOR_EM, rotulo: 'é um de' },
        { valor: OPERADOR_NAO_EM, rotulo: 'não é nenhum de' },
      ];
  }
}

/** Se o operador compara contra uma LISTA de valores, e não contra um só. */
export function comparaComLista(operador: string): boolean {
  return operador === OPERADOR_EM || operador === OPERADOR_NAO_EM;
}

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
  if (valor === '') return { ...condicao, valor: '' };

  if (fato.tipoDominio === 'BOOLEANO') {
    // Só os dois tokens do domínio são aceitos. Qualquer outra coisa volta ao estado sem
    // valor, que a conferência acusa — tratar o não reconhecido como "não" gravaria
    // silenciosamente o oposto do que foi escrito, e o servidor aceitaria, porque é booleano
    // JSON válido.
    return {
      ...condicao,
      valor: valor === VALOR_VERDADEIRO || valor === VALOR_FALSO ? valor : '',
    };
  }

  if (fato.tipoDominio === 'NUMERICO') {
    // O que foi escrito é guardado como veio, e a conferência acusa o que o domínio recusa —
    // ele só aceita inteiro. Truncar aqui gravava um número diferente do que ficava na tela:
    // quem digitava 1412.50 via 1412.50 e gravava 1412, sem nada dizer.
    return { ...condicao, valor: valor.trim() };
  }

  return { ...condicao, valor: JSON.stringify(valor) };
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
  if (comparaComLista(operador) === comparaComLista(condicao.operador)) {
    return { ...condicao, operador };
  }

  if (comparaComLista(operador)) {
    const escalar = valorEscalarDe(condicao);
    return comValoresDeLista({ ...condicao, operador }, escalar === '' ? [] : [escalar]);
  }

  const [primeiro] = valoresDeListaDe(condicao);
  return comValorEscalar({ ...condicao, operador }, fato, primeiro ?? '');
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
