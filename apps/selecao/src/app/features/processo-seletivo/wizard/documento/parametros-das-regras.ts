import type { ParametrosDaEliminacao, ParametrosDoDesempate } from '@uniplus/shared-data/selecao';

type FormaDosParametros<T> = {
  readonly [K in keyof Required<T>]: (valor: unknown) => valor is T[K];
};
type Parametros = Readonly<Record<string, unknown>>;
type Leitura<M> =
  | {
      [C in keyof M]: {
        readonly conhecida: true;
        readonly codigo: C;
        readonly valores: Partial<M[C]>;
      };
    }[keyof M]
  | { readonly conhecida: false };

const texto = (valor: unknown): valor is string => typeof valor === 'string';
const numero = (valor: unknown): valor is number =>
  typeof valor === 'number' && Number.isFinite(valor);
const textos = (valor: unknown): valor is readonly string[] =>
  Array.isArray(valor) && valor.every(texto);

const notaMinima = { etapaChave: texto, notaMinima: numero } satisfies FormaDosParametros<
  ParametrosDaEliminacao['ELIMINACAO_NOTA_MINIMA_ETAPA']
>;
const corte = { areaCodigo: texto, minimo: numero } satisfies FormaDosParametros<
  ParametrosDaEliminacao['ELIMINACAO_CORTE_EM_AREA']
>;
const ausencia = { etapaChave: texto } satisfies FormaDosParametros<
  ParametrosDaEliminacao['ELIMINACAO_AUSENCIA_NA_ETAPA']
>;
const etapa = { etapaChave: texto } satisfies FormaDosParametros<
  ParametrosDoDesempate['DESEMPATE_MAIOR_NOTA_ETAPA']
>;
const idoso = { idadeMinima: numero } satisfies FormaDosParametros<
  ParametrosDoDesempate['DESEMPATE_IDOSO']
>;
const areas = { areas: textos } satisfies FormaDosParametros<
  ParametrosDoDesempate['DESEMPATE_MAIOR_NOTA_AREA_ENEM']
>;

export function camposComForma<T>(
  parametros: Parametros,
  forma: FormaDosParametros<T>,
): Partial<T> {
  const resultado: Partial<T> = {};
  for (const campo in forma) {
    const valor = parametros[campo];
    if (forma[campo](valor)) resultado[campo] = valor;
  }
  return resultado;
}

export function lerParametrosDaEliminacao(
  codigo: string,
  parametros: Parametros = {},
): Leitura<ParametrosDaEliminacao> {
  if (codigo === 'ELIMINACAO_ZERO_EM_AREA' || codigo === 'ELIMINACAO_FALTA_EM_DIA_DE_PROVA_ENEM')
    return { conhecida: true, codigo, valores: {} };
  if (codigo === 'ELIMINACAO_AUSENCIA_NA_ETAPA')
    return { conhecida: true, codigo, valores: camposComForma(parametros, ausencia) };
  if (codigo === 'ELIMINACAO_NOTA_MINIMA_ETAPA')
    return { conhecida: true, codigo, valores: camposComForma(parametros, notaMinima) };
  if (codigo === 'ELIMINACAO_CORTE_EM_AREA')
    return { conhecida: true, codigo, valores: camposComForma(parametros, corte) };
  return { conhecida: false };
}

export function lerParametrosDoDesempate(
  codigo: string,
  parametros: Parametros = {},
): Leitura<ParametrosDoDesempate> {
  if (codigo === 'DESEMPATE_MAIOR_IDADE') return { conhecida: true, codigo, valores: {} };
  if (codigo === 'DESEMPATE_MAIOR_NOTA_AREA_ENEM')
    return { conhecida: true, codigo, valores: camposComForma(parametros, areas) };
  if (codigo === 'DESEMPATE_MAIOR_NOTA_ETAPA')
    return { conhecida: true, codigo, valores: camposComForma(parametros, etapa) };
  if (codigo === 'DESEMPATE_IDOSO')
    return { conhecida: true, codigo, valores: camposComForma(parametros, idoso) };
  return { conhecida: false };
}
