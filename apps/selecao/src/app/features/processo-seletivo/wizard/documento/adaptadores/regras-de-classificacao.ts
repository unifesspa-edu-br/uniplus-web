import type { DocumentoDaConfiguracaoReferenciaDeRegra } from '@uniplus/shared-data/selecao';
import { rotuloDoCodigo, type CatalogoPorCodigo } from '../catalogos-por-codigo';
import { referenciaQueVale, regraEscolhida, type RegraEscolhida } from '../regra-escolhida';
import { comCampo } from '../edicoes/secao-do-documento';

export interface ItemDaRegra<P> {
  readonly origem: number | null;
  readonly codigo: string;
  readonly versao: string;
  readonly nome: string;
  readonly parametros: P;
}

export function dadosDaRegra<P>(
  regra: DocumentoDaConfiguracaoReferenciaDeRegra,
  origem: number,
  catalogo: CatalogoPorCodigo,
  parametros: P,
): ItemDaRegra<P> {
  const { codigo, versao } = regraEscolhida(regra) ?? { codigo: '', versao: '' };
  return {
    origem,
    codigo,
    versao,
    nome: rotuloDoCodigo(catalogo, codigo, undefined),
    parametros,
  };
}

export function regraAlterada<
  T extends {
    readonly regra: DocumentoDaConfiguracaoReferenciaDeRegra;
    readonly parametros?: Readonly<Record<string, unknown>>;
  },
>(atual: T, escolha: RegraEscolhida): T {
  const regra = referenciaQueVale(atual.regra, escolha) ?? {};
  if (regra === atual.regra) return atual;
  const item = { ...atual, regra };
  return atual.regra.codigo === regra.codigo ? item : comCampo(item, 'parametros', undefined);
}

export function parametrosAlterados<
  T extends { readonly parametros?: Readonly<Record<string, unknown>> },
>(
  atual: T,
  antes: Readonly<Record<string, unknown>>,
  depois: Readonly<Record<string, unknown>>,
): T {
  const parametros = mesclarParametros(atual.parametros ?? {}, antes, depois);
  return parametros === atual.parametros ||
    (atual.parametros === undefined && Object.keys(parametros).length === 0)
    ? atual
    : { ...atual, parametros };
}

function mesclarParametros(
  parametrosIniciais: Readonly<Record<string, unknown>>,
  antes: Readonly<Record<string, unknown>>,
  depois: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  let parametros = parametrosIniciais;
  for (const campo of new Set([...Object.keys(antes), ...Object.keys(depois)])) {
    const valor = depois[campo];
    if (Object.is(antes[campo], valor) || (typeof valor === 'number' && !Number.isFinite(valor)))
      continue;
    parametros = comCampo(parametros, campo, valor);
  }
  return parametros;
}
