import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import type { CatalogoPorCodigo } from '../catalogos-por-codigo';
import { paresPorOrigem } from '../edicoes/itens-por-origem';
import { comLista, naSecao, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';
import { lerParametrosDoDesempate } from '../parametros-das-regras';
import {
  dadosDaRegra,
  parametrosAlterados,
  regraAlterada,
  type ItemDaRegra,
} from './regras-de-classificacao';

type Desempate = NonNullable<
  NonNullable<DocumentoDaConfiguracao['classificacao']>['criteriosDeDesempate']
>[number];
type Leitura = ReturnType<typeof lerParametrosDoDesempate>;
export type ItemDoDesempate = ItemDaRegra<Leitura>;
export interface ValoresDoDesempate {
  readonly itens: readonly ItemDoDesempate[];
}

function itemDoFormulario(
  item: Desempate,
  origem: number,
  catalogo: CatalogoPorCodigo,
): ItemDoDesempate {
  return dadosDaRegra(
    item.regra,
    origem,
    catalogo,
    lerParametrosDoDesempate(item.regra.codigo ?? '', item.parametros),
  );
}

export function valoresDoFormulario(
  documento: DocumentoDaConfiguracao,
  catalogos: CatalogoPorCodigo,
): ValoresDoDesempate {
  return {
    itens: (documento.classificacao?.criteriosDeDesempate ?? []).map((item, origem) =>
      itemDoFormulario(item, origem, catalogos),
    ),
  };
}

function itemEditado(atual: Desempate | undefined, valor: ItemDoDesempate): Desempate {
  const original = atual ?? { regra: {} };
  const item = regraAlterada(original, valor);
  const antes = lerParametrosDoDesempate(item.regra.codigo ?? '', item.parametros);
  if (!antes.conhecida || !valor.parametros.conhecida || antes.codigo !== valor.parametros.codigo)
    return item;
  return parametrosAlterados(item, antes.valores, valor.parametros.valores);
}

export function edicaoDoPasso(valores: ValoresDoDesempate): EdicaoDoDocumento {
  return (documento) =>
    naSecao(documento, 'classificacao', (secao) => {
      const pares = paresPorOrigem(secao.criteriosDeDesempate ?? [], valores.itens);
      return comLista(
        secao,
        'criteriosDeDesempate',
        pares.map(([atual, valor]) => itemEditado(atual, valor)),
      );
    });
}
