import { deslocarDia, diaDoCalendario } from '@uniplus/shared-utils';

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
import type { ValorJson } from './regras-do-formulario';

/** As opções que uma restrição deixa escolher; definitivas quando nenhuma resposta pendente pode mudá-las. */
export interface OpcoesDaRestricao {
  readonly codigos: readonly string[];
  readonly definitivas: boolean;
}

/** Os tipos de restrição sobre a resposta, pelo token do contrato. */
export const FAIXA_NUMERICA = 'FAIXA_NUMERICA';
export const TAMANHO_TEXTO = 'TAMANHO_TEXTO';
export const OPCOES_PERMITIDAS = 'OPCOES_PERMITIDAS';
export const OPCOES_DAS_RESPOSTAS = 'OPCOES_DAS_RESPOSTAS';
export const MUNICIPIOS_DA_UF = 'MUNICIPIOS_DA_UF';
/** O formato do campo de texto, que a avaliação confere junto das restrições declaradas. */
export const FORMATO_TEXTO = 'FORMATO_TEXTO';
export const FAIXA_DE_DATA = 'FAIXA_DE_DATA';

/**
 * O que a restrição consulta além da resposta: os fatos já resolvidos e o dia do envio, `AAAA-MM-DD` no
 * fuso do envio, ou nulo quando o envio não se sabe. O dia vem de fora: o avaliador não lê relógio.
 */
export interface ContextoDaResposta {
  readonly fatos: Fatos;
  readonly diaDoEnvio: string | null;
}

/**
 * Uma restrição sobre o valor respondido: se a resposta, já sabida não vazia, a atende — verdadeiro,
 * falso, ou indeterminado quando depende de resposta anterior ainda desconhecida —, e as opções que ela
 * deixa escolher, quando limita a escolha a um conjunto.
 */
export interface Restricao {
  readonly tipo: string;
  readonly fatosCitados: readonly string[];
  avaliar(resposta: ValorJson, contexto: ContextoDaResposta): Ternario;
  opcoes(fatos: Fatos): OpcoesDaRestricao | null;
}

export class FaixaNumerica implements Restricao {
  readonly tipo = FAIXA_NUMERICA;
  readonly fatosCitados: readonly string[] = [];

  constructor(
    private readonly minimo: number | null,
    private readonly maximo: number | null,
  ) {}

  avaliar(resposta: ValorJson): Ternario {
    return typeof resposta === 'number'
      ? comoTernario(
          (this.minimo === null || resposta >= this.minimo) &&
            (this.maximo === null || resposta <= this.maximo),
        )
      : FALSO;
  }

  opcoes(): null {
    return null;
  }
}

/** O tamanho conta sem os espaços das pontas. */
export class TamanhoDeTexto implements Restricao {
  readonly tipo = TAMANHO_TEXTO;
  readonly fatosCitados: readonly string[] = [];

  constructor(
    private readonly minimo: number | null,
    private readonly maximo: number | null,
  ) {}

  avaliar(resposta: ValorJson): Ternario {
    if (typeof resposta !== 'string') return FALSO;
    const tamanho = resposta.trim().length;
    return comoTernario(
      (this.minimo === null || tamanho >= this.minimo) &&
        (this.maximo === null || tamanho <= this.maximo),
    );
  }

  opcoes(): null {
    return null;
  }
}

export class FormatoDeTexto implements Restricao {
  readonly tipo = FORMATO_TEXTO;
  readonly fatosCitados: readonly string[] = [];

  constructor(private readonly formato: string) {}

  avaliar(resposta: ValorJson): Ternario {
    return comoTernario(typeof resposta === 'string' && atendeAoFormato(this.formato, resposta));
  }

  opcoes(): null {
    return null;
  }
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
export class OpcoesPermitidas implements Restricao {
  readonly tipo = OPCOES_PERMITIDAS;
  readonly fatosCitados: readonly string[];

  constructor(private readonly entradas: readonly OpcoesCondicionadas[]) {
    this.fatosCitados = [
      ...new Set(entradas.flatMap((entrada) => fatosCitadosPor(entrada.quando))),
    ];
  }

  private vigentes(fatos: Fatos): { vigentes: Set<string>; talvez: Set<string> } {
    const certas = new Set<string>();
    const talvez = new Set<string>();
    for (const entrada of this.entradas) {
      const vale = avaliarOuVerdadeiro(entrada.quando, fatos);
      if (vale === VERDADEIRO) entrada.valores.forEach((valor) => certas.add(valor));
      else if (vale === INDETERMINADO) entrada.valores.forEach((valor) => talvez.add(valor));
    }
    return { vigentes: certas, talvez };
  }

  avaliar(resposta: ValorJson, { fatos }: ContextoDaResposta): Ternario {
    const { vigentes, talvez } = this.vigentes(fatos);
    return escolheSoEntre(resposta, vigentes, talvez);
  }

  opcoes(fatos: Fatos): OpcoesDaRestricao {
    const { vigentes, talvez } = this.vigentes(fatos);
    return opcoesVigentes(
      vigentes,
      [...talvez].every((valor) => vigentes.has(valor)),
    );
  }
}

/**
 * A resposta escolhe só entre as respostas dadas a campos anteriores. O fato não aplicável ou não
 * informado não contribui; só o ainda indeterminado deixa as opções em aberto.
 */
export class OpcoesDasRespostas implements Restricao {
  readonly tipo = OPCOES_DAS_RESPOSTAS;
  readonly fatosCitados: readonly string[];

  constructor(fatosDeOrigem: readonly string[]) {
    this.fatosCitados = codigosEmOrdem(fatosDeOrigem);
  }

  avaliar(resposta: ValorJson, { fatos }: ContextoDaResposta): Ternario {
    const vigentes = this.opcoes(fatos);
    const resultado = escolheSoEntre(resposta, new Set(vigentes.codigos), new Set());
    // Uma resposta ainda desconhecida pode trazer qualquer opção: o que não está entre as conhecidas
    // fica indeterminado, salvo a resposta de forma inválida.
    return resultado === FALSO && !vigentes.definitivas && codigosDa(resposta) !== null
      ? INDETERMINADO
      : resultado;
  }

  opcoes(fatos: Fatos): OpcoesDaRestricao {
    const codigos = new Set<string>();
    let definitivas = true;
    for (const codigo of this.fatosCitados) {
      const fato = fatos.get(codigo);
      if (!fato || fato.estado === INDETERMINADO) definitivas = false;
      else if (fato.estado === RESOLVIDO)
        codigosDa(fato.valor)?.forEach((codigo) => codigos.add(codigo));
    }
    return opcoesVigentes(codigos, definitivas);
  }
}

/** O município da UF respondida antes, conferido pelo prefixo do código IBGE. */
export class MunicipiosDaUf implements Restricao {
  readonly tipo = MUNICIPIOS_DA_UF;
  readonly fatosCitados: readonly string[];

  constructor(private readonly fatoUf: string) {
    this.fatosCitados = [fatoUf];
  }

  avaliar(resposta: ValorJson, { fatos }: ContextoDaResposta): Ternario {
    const uf = fatos.get(this.fatoUf);
    if (!uf || uf.estado === INDETERMINADO) return INDETERMINADO;
    return comoTernario(
      uf.estado === RESOLVIDO &&
        typeof uf.valor === 'string' &&
        typeof resposta === 'string' &&
        ufDoCodigoIbge(resposta) === uf.valor,
    );
  }

  opcoes(): null {
    return null;
  }
}

/** O maior deslocamento do dia do envio, em anos e em dias, para mais ou para menos, como na API. */
export const TETO_DE_ANOS = 150;
export const TETO_DE_DIAS = TETO_DE_ANOS * 366;

/** Um limite da faixa de data: uma data fixa, ou o dia do envio deslocado em anos e depois em dias. */
export type LimiteDeData =
  | { readonly ancora: 'DATA_FIXA'; readonly data: string }
  | { readonly ancora: 'ENVIO'; readonly anos: number; readonly dias: number };

/** O dia do limite; nulo quando ele conta do envio e o dia do envio não se sabe. */
export function diaDoLimite(limite: LimiteDeData, diaDoEnvio: string | null): string | null {
  if (limite.ancora === 'DATA_FIXA') return limite.data;
  return diaDoEnvio === null ? null : deslocarDia(diaDoEnvio, limite.anos, limite.dias);
}

/**
 * Se a mínima cai depois da máxima seja qual for o dia do envio, como a API recusa: entre duas datas
 * fixas, pela data; entre dois limites contados do envio, quando a mínima desloca ao menos tanto nos
 * anos e nos dias, e mais em um deles, porque somar anos e depois dias nunca recua o dia. A ordem que
 * depende do dia do envio não é recusada.
 */
export function minimaDepoisDaMaxima(minima: LimiteDeData, maxima: LimiteDeData): boolean {
  if (minima.ancora === 'DATA_FIXA' && maxima.ancora === 'DATA_FIXA')
    return minima.data > maxima.data;
  if (minima.ancora === 'ENVIO' && maxima.ancora === 'ENVIO')
    return (
      minima.anos >= maxima.anos &&
      minima.dias >= maxima.dias &&
      (minima.anos > maxima.anos || minima.dias > maxima.dias)
    );
  return false;
}

const diaDoLimiteOpcional = (
  limite: LimiteDeData | null,
  diaDoEnvio: string | null,
): string | null => (limite === null ? null : diaDoLimite(limite, diaDoEnvio));

const foraDosDias = (data: string, inicio: string | null, fim: string | null): boolean =>
  (inicio !== null && data < inicio) || (fim !== null && data > fim);

/** O limite existe, mas o dia dele não se sabe: depende do dia do envio. */
const limiteSemDia = (limite: LimiteDeData | null, dia: string | null): boolean =>
  limite !== null && dia === null;

/**
 * A resposta de data dentro dos limites no dia do envio. O dia é comparado como `AAAA-MM-DD`, que
 * ordena como o calendário. A data fora de um limite conhecido viola em definitivo; dentro dos
 * conhecidos, com um limite contado do envio que não se sabe, fica indeterminada.
 */
export class FaixaDeData implements Restricao {
  readonly tipo = FAIXA_DE_DATA;
  readonly fatosCitados: readonly string[] = [];

  constructor(
    private readonly minima: LimiteDeData | null,
    private readonly maxima: LimiteDeData | null,
  ) {}

  avaliar(resposta: ValorJson, { diaDoEnvio }: ContextoDaResposta): Ternario {
    const data = typeof resposta === 'string' ? diaDoCalendario(resposta) : null;
    if (data === null) return FALSO;
    const inicio = diaDoLimiteOpcional(this.minima, diaDoEnvio);
    const fim = diaDoLimiteOpcional(this.maxima, diaDoEnvio);
    if (foraDosDias(data, inicio, fim)) return FALSO;
    return limiteSemDia(this.minima, inicio) || limiteSemDia(this.maxima, fim)
      ? INDETERMINADO
      : VERDADEIRO;
  }

  opcoes(): null {
    return null;
  }
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

function opcoesVigentes(codigos: Iterable<string>, definitivas: boolean): OpcoesDaRestricao {
  return { codigos: codigosEmOrdem(codigos), definitivas };
}

/** A interseção das opções de duas restrições: definitivas só se as duas forem. */
export function juntarOpcoes(
  umas: OpcoesDaRestricao,
  outras: OpcoesDaRestricao,
): OpcoesDaRestricao {
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

export function codigosEmOrdem(codigos: Iterable<string>): string[] {
  return [...new Set(codigos)].sort(compararOrdinal);
}
