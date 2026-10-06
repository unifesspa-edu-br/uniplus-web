import { atendeAoFormato, ufDoCodigoIbge } from './formatos';
import {
  codigosDa,
  comoTernario,
  FALSO,
  type Fatos,
  INDETERMINADO,
  RESOLVIDO,
  type Ternario,
  VERDADEIRO,
} from './logica';
import { avaliarOuVerdadeiro, fatosCitadosPor, type Predicado } from './predicado';
import type { OpcoesVigentes, ValorJson } from './regras-do-formulario';

/** Os tipos de restrição sobre a resposta, pelo token do contrato. */
export const FAIXA_NUMERICA = 'FAIXA_NUMERICA';
export const TAMANHO_TEXTO = 'TAMANHO_TEXTO';
export const OPCOES_PERMITIDAS = 'OPCOES_PERMITIDAS';
export const OPCOES_DAS_RESPOSTAS = 'OPCOES_DAS_RESPOSTAS';
export const MUNICIPIOS_DA_UF = 'MUNICIPIOS_DA_UF';
/** O formato do campo de texto, que a avaliação confere junto das restrições declaradas. */
export const FORMATO_TEXTO = 'FORMATO_TEXTO';

/**
 * Uma restrição sobre o valor respondido: se a resposta, já sabida não vazia, a atende — verdadeiro,
 * falso, ou indeterminado quando depende de resposta anterior ainda desconhecida —, e as opções que ela
 * deixa escolher, quando limita a escolha a um conjunto.
 */
export interface Restricao {
  readonly tipo: string;
  readonly fatosCitados: readonly string[];
  avaliar(resposta: ValorJson, fatos: Fatos): Ternario;
  opcoes(fatos: Fatos): OpcoesVigentes | null;
}

const semOpcoes = (): null => null;

export function faixaNumerica(minimo: number | null, maximo: number | null): Restricao {
  return {
    tipo: FAIXA_NUMERICA,
    fatosCitados: [],
    avaliar: (resposta) =>
      typeof resposta === 'number'
        ? comoTernario(
            (minimo === null || resposta >= minimo) && (maximo === null || resposta <= maximo),
          )
        : FALSO,
    opcoes: semOpcoes,
  };
}

/** O tamanho conta sem os espaços das pontas. */
export function tamanhoDeTexto(minimo: number | null, maximo: number | null): Restricao {
  return {
    tipo: TAMANHO_TEXTO,
    fatosCitados: [],
    avaliar: (resposta) => {
      if (typeof resposta !== 'string') return FALSO;
      const tamanho = resposta.trim().length;
      return comoTernario(
        (minimo === null || tamanho >= minimo) && (maximo === null || tamanho <= maximo),
      );
    },
    opcoes: semOpcoes,
  };
}

export function formatoDeTexto(formato: string): Restricao {
  return {
    tipo: FORMATO_TEXTO,
    fatosCitados: [],
    avaliar: (resposta) =>
      comoTernario(typeof resposta === 'string' && atendeAoFormato(formato, resposta)),
    opcoes: semOpcoes,
  };
}

export interface OpcoesCondicionadas {
  /** Nula quando o grupo de opções vale sempre. */
  readonly quando: Predicado | null;
  readonly valores: readonly string[];
}

/**
 * A resposta escolhe só entre as opções vigentes: a união dos grupos cuja condição é verdadeira. Uma
 * condição ainda desconhecida só pode acrescentar opções, então a resposta dentro das vigentes vale
 * em definitivo, e só o que depende das desconhecidas fica indeterminado.
 */
export function opcoesPermitidas(entradas: readonly OpcoesCondicionadas[]): Restricao {
  const vigentes = (fatos: Fatos): { vigentes: Set<string>; talvez: Set<string> } => {
    const certas = new Set<string>();
    const talvez = new Set<string>();
    for (const entrada of entradas) {
      const vale = avaliarOuVerdadeiro(entrada.quando, fatos);
      if (vale === VERDADEIRO) entrada.valores.forEach((v) => certas.add(v));
      else if (vale === INDETERMINADO) entrada.valores.forEach((v) => talvez.add(v));
    }
    return { vigentes: certas, talvez };
  };

  return {
    tipo: OPCOES_PERMITIDAS,
    fatosCitados: [...new Set(entradas.flatMap((e) => fatosCitadosPor(e.quando)))],
    avaliar: (resposta, fatos) => {
      const { vigentes: certas, talvez } = vigentes(fatos);
      return escolheSoEntre(resposta, certas, talvez);
    },
    opcoes: (fatos) => {
      const { vigentes: certas, talvez } = vigentes(fatos);
      return opcoesVigentes(
        certas,
        [...talvez].every((v) => certas.has(v)),
      );
    },
  };
}

/**
 * A resposta escolhe só entre as respostas dadas a campos anteriores. O fato não aplicável ou não
 * informado não contribui; só o ainda indeterminado deixa as opções em aberto.
 */
export function opcoesDasRespostas(fatosDeOrigem: readonly string[]): Restricao {
  const ordenados = [...new Set(fatosDeOrigem)].sort(compararOrdinal);
  const opcoes = (fatos: Fatos): OpcoesVigentes => {
    const codigos = new Set<string>();
    let definitivas = true;
    for (const codigo of ordenados) {
      const fato = fatos.get(codigo);
      if (!fato || fato.estado === INDETERMINADO) definitivas = false;
      else if (fato.estado === RESOLVIDO) codigosDa(fato.valor)?.forEach((c) => codigos.add(c));
    }
    return opcoesVigentes(codigos, definitivas);
  };

  return {
    tipo: OPCOES_DAS_RESPOSTAS,
    fatosCitados: ordenados,
    avaliar: (resposta, fatos) => {
      const vigentes = opcoes(fatos);
      const resultado = escolheSoEntre(resposta, new Set(vigentes.codigos), new Set());
      // Uma resposta ainda desconhecida pode trazer qualquer opção: o que não está entre as conhecidas
      // fica indeterminado, salvo a resposta de forma inválida.
      return resultado === FALSO && !vigentes.definitivas && codigosDa(resposta) !== null
        ? INDETERMINADO
        : resultado;
    },
    opcoes,
  };
}

/** O município da UF respondida antes, conferido pelo prefixo do código IBGE. */
export function municipiosDaUf(fatoUf: string): Restricao {
  return {
    tipo: MUNICIPIOS_DA_UF,
    fatosCitados: [fatoUf],
    avaliar: (resposta, fatos) => {
      const uf = fatos.get(fatoUf);
      if (!uf || uf.estado === INDETERMINADO) return INDETERMINADO;
      return comoTernario(
        uf.estado === RESOLVIDO &&
          typeof uf.valor === 'string' &&
          typeof resposta === 'string' &&
          ufDoCodigoIbge(resposta) === uf.valor,
      );
    },
    opcoes: semOpcoes,
  };
}

function escolheSoEntre(
  resposta: ValorJson,
  vigentes: ReadonlySet<string>,
  talvez: ReadonlySet<string>,
): Ternario {
  const codigos = codigosDa(resposta);
  if (codigos === null) return FALSO;
  if (codigos.every((c) => vigentes.has(c))) return VERDADEIRO;
  return codigos.every((c) => vigentes.has(c) || talvez.has(c)) ? INDETERMINADO : FALSO;
}

function opcoesVigentes(codigos: Iterable<string>, definitivas: boolean): OpcoesVigentes {
  return { codigos: [...new Set(codigos)].sort(compararOrdinal), definitivas };
}

/** A interseção das opções de duas restrições: definitivas só se as duas forem. */
export function juntarOpcoes(umas: OpcoesVigentes, outras: OpcoesVigentes): OpcoesVigentes {
  const delas = new Set(outras.codigos);
  return {
    codigos: umas.codigos.filter((c) => delas.has(c)),
    definitivas: umas.definitivas && outras.definitivas,
  };
}

/** A ordem ordinal dos códigos, a mesma da API. */
export function compararOrdinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
