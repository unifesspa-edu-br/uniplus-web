import type { BancaDeclarada } from '../../modelos/banca.models';
import { CAMPOS_DA_BANCA, type CampoDaBanca } from '../deliberacao/recusas-da-regra';
import { emOrdem, type RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { bancaDoCampo, type ListaDeBancas } from './campo-da-banca';

export const NOTA_DA_BANCA_AUSENTE = 'Sobre uma banca que não está mais nesta tela.';

/** O que a recusa a uma banca pode apontar além da banca inteira: a regra dela ou as categorias. */
export type ControleDaBanca = CampoDaBanca | 'categoriasDocumentoIds';

export type RecusasPorControle = Partial<Record<ControleDaBanca, readonly RecusaOrdenada[]>>;

/**
 * As recusas de uma lista de bancas: as da seção, as que apontam só a banca que está na tela e,
 * por banca, as de cada controle dela. Cada recusa aparece em um só lugar.
 */
export interface RecusasDasBancas {
  readonly secao: readonly RecusaOrdenada[];
  readonly daBanca: ReadonlyMap<string, readonly RecusaOrdenada[]>;
  readonly porControle: ReadonlyMap<string, RecusasPorControle>;
}

/** A recusa com a banca da tela que ela aponta e o controle dessa banca, quando há. */
interface RecusaDaBanca {
  readonly recusa: RecusaOrdenada;
  readonly banca: string | undefined;
  readonly controle: ControleDaBanca | undefined;
}

function doTipoDaLista(recusa: RecusaOrdenada, lista: ListaDeBancas): boolean {
  return recusa.campo === lista || recusa.campo.startsWith(`${lista}.`);
}

/** A nota que acompanha a recusa a uma banca que não está mais na tela; sem nota nos demais casos. */
export function notaDaBanca(bancaAusente: boolean | undefined): string | undefined {
  return bancaAusente === true ? NOTA_DA_BANCA_AUSENTE : undefined;
}

function controleConhecido(controle: string | null | undefined): ControleDaBanca | undefined {
  if (controle === 'categoriasDocumentoIds') return controle;
  return CAMPOS_DA_BANCA.find((campo) => campo === controle);
}

function situarNaTela(
  recusa: RecusaOrdenada,
  lista: ListaDeBancas,
  naTela: ReadonlySet<string>,
): RecusaDaBanca {
  const banca = bancaDoCampo(recusa.campo, lista);
  const estaNaTela = banca !== null && naTela.has(banca.identificador);
  return {
    recusa,
    banca: estaNaTela ? banca.identificador : undefined,
    controle: controleConhecido(banca?.controle),
  };
}

function comANotaDaBancaAusente(recusa: RecusaOrdenada, lista: ListaDeBancas): RecusaOrdenada {
  return bancaDoCampo(recusa.campo, lista) === null
    ? recusa
    : { ...recusa, nota: NOTA_DA_BANCA_AUSENTE };
}

function agruparPorBanca(recusas: readonly RecusaDaBanca[]): Map<string, RecusaDaBanca[]> {
  const porBanca = new Map<string, RecusaDaBanca[]>();
  for (const item of recusas) {
    if (item.banca !== undefined)
      porBanca.set(item.banca, [...(porBanca.get(item.banca) ?? []), item]);
  }
  return porBanca;
}

function agruparPorControle(recusas: readonly RecusaDaBanca[]): RecusasPorControle {
  const porControle: RecusasPorControle = {};
  for (const { recusa, controle } of recusas) {
    if (controle !== undefined) porControle[controle] = [...(porControle[controle] ?? []), recusa];
  }
  return porControle;
}

function transformar<T, R>(
  mapa: ReadonlyMap<string, T>,
  converter: (valor: T) => R,
): Map<string, R> {
  return new Map([...mapa].map(([chave, valor]) => [chave, converter(valor)]));
}

function repartir(situadas: readonly RecusaDaBanca[], lista: ListaDeBancas): RecusasDasBancas {
  const daBanca = agruparPorBanca(situadas.filter(({ controle }) => controle === undefined));
  const dosControles = agruparPorBanca(situadas.filter(({ controle }) => controle !== undefined));
  return {
    secao: situadas
      .filter(({ banca }) => banca === undefined)
      .map(({ recusa }) => comANotaDaBancaAusente(recusa, lista)),
    daBanca: transformar(daBanca, (itens) => itens.map(({ recusa }) => recusa)),
    porControle: transformar(dosControles, agruparPorControle),
  };
}

/**
 * Reparte as recusas da lista de bancas: a da banca que está na tela fica com ela, no controle
 * que aponta ou, sem controle, na banca inteira; as da seção ou de uma banca que saiu da tela
 * ficam na seção, estas com a nota que diz isso.
 */
export function recusasDasBancas(
  recusas: readonly RecusaOrdenada[],
  lista: ListaDeBancas,
  bancas: readonly BancaDeclarada[],
): RecusasDasBancas {
  const naTela = new Set(bancas.map((banca) => banca.identificadorLocal));
  const doTipo = emOrdem(recusas.filter((item) => doTipoDaLista(item, lista)));
  return repartir(
    doTipo.map((recusa) => situarNaTela(recusa, lista, naTela)),
    lista,
  );
}
