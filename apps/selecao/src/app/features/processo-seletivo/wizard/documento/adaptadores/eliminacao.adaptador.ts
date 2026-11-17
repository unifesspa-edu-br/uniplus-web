import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import type { CatalogoPorCodigo } from '../catalogos-por-codigo';
import { paresPorOrigem } from '../edicoes/itens-por-origem';
import { comLista, naSecao, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';
import { lerParametrosDaEliminacao } from '../parametros-das-regras';
import {
  dadosDaRegra,
  parametrosAlterados,
  regraAlterada,
  type ItemDaRegra,
} from './regras-de-classificacao';

type Eliminacao = NonNullable<
  NonNullable<DocumentoDaConfiguracao['classificacao']>['regrasEliminacao']
>[number];
type Leitura = ReturnType<typeof lerParametrosDaEliminacao>;
export type ItemDaEliminacao = ItemDaRegra<Leitura>;
export interface ValoresDaEliminacao {
  readonly itens: readonly ItemDaEliminacao[];
}

export function valoresDoFormulario(
  documento: DocumentoDaConfiguracao,
  catalogos: CatalogoPorCodigo,
): ValoresDaEliminacao {
  return {
    itens: (documento.classificacao?.regrasEliminacao ?? []).map((item, origem) =>
      dadosDaRegra(
        item.regra,
        origem,
        catalogos,
        lerParametrosDaEliminacao(item.regra.codigo ?? '', item.parametros),
      ),
    ),
  };
}

function itemEditado(atual: Eliminacao | undefined, valor: ItemDaEliminacao): Eliminacao {
  const original = atual ?? { regra: {} };
  const item = regraAlterada(original, valor);
  const antes = lerParametrosDaEliminacao(item.regra.codigo ?? '', item.parametros);
  if (!antes.conhecida || !valor.parametros.conhecida || antes.codigo !== valor.parametros.codigo)
    return item;
  return parametrosAlterados(item, antes.valores, valor.parametros.valores);
}

export function edicaoDoPasso(valores: ValoresDaEliminacao): EdicaoDoDocumento {
  return (documento) =>
    naSecao(documento, 'classificacao', (secao) => {
      const pares = paresPorOrigem(secao.regrasEliminacao ?? [], valores.itens);
      return comLista(
        secao,
        'regrasEliminacao',
        pares.map(([atual, valor]) => itemEditado(atual, valor)),
      );
    });
}
