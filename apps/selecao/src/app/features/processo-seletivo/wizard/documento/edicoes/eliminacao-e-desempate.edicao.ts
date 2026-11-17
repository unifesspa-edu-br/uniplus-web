import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { comCampo, naSecao } from './secao-do-documento';

type Classificacao = NonNullable<DocumentoDaConfiguracao['classificacao']>;
type Eliminacao = NonNullable<Classificacao['regrasEliminacao']>[number];
type Desempate = NonNullable<Classificacao['criteriosDeDesempate']>[number];

function comParametro<T extends Eliminacao | Desempate>(item: T, campo: string, valor: unknown): T {
  if (typeof valor === 'number' && !Number.isFinite(valor)) return item;
  const parametros = comCampo(item.parametros ?? {}, campo, valor);
  if (
    parametros === item.parametros ||
    (item.parametros === undefined && Object.keys(parametros).length === 0)
  )
    return item;
  return { ...item, parametros };
}

export function definirParametroDaEliminacao(
  documento: DocumentoDaConfiguracao,
  posicao: number,
  campo: string,
  valor: unknown,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'classificacao', (secao) => {
    const itens = secao.regrasEliminacao;
    if (!itens?.[posicao]) return secao;
    const novos = itens.map((item, indice) =>
      indice === posicao ? comParametro(item, campo, valor) : item,
    );
    return comCampo(secao, 'regrasEliminacao', novos);
  });
}

export function definirParametroDoDesempate(
  documento: DocumentoDaConfiguracao,
  posicao: number,
  campo: string,
  valor: unknown,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'classificacao', (secao) => {
    const itens = secao.criteriosDeDesempate;
    if (!itens?.[posicao]) return secao;
    const novos = itens.map((item, indice) =>
      indice === posicao ? comParametro(item, campo, valor) : item,
    );
    return comCampo(secao, 'criteriosDeDesempate', novos);
  });
}
