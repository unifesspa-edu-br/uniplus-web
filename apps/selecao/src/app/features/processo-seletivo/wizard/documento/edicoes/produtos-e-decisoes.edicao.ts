import {
  TipoDeDecisaoDoDocumento,
  type DocumentoDaConfiguracaoProduto,
  type PapelDoProduto,
} from '@uniplus/shared-data/selecao';

import { membroDoEnum } from '../membro-do-enum';
import { textoQueVale } from '../valor-que-vale';
import { itensEditadosPorOrigem } from './itens-por-posicao';
import { comAlteracoes } from './partes-por-chave';
import { comCampo, comEscolha, comLista } from './secao-do-documento';

type Produto = DocumentoDaConfiguracaoProduto;

/** O ato que a fase ou a etapa produz e se ele é preliminar ou definitivo. */
export interface ProdutoDoFormulario {
  readonly origem?: number;
  readonly atoCodigo: string;
  readonly papel: PapelDoProduto | '';
}

function produtoComValores(atual: Produto | undefined, valores: ProdutoDoFormulario): Produto {
  return comAlteracoes(
    atual ?? { atoCodigo: '' },
    (produto) =>
      comCampo(produto, 'atoCodigo', textoQueVale(produto.atoCodigo, valores.atoCodigo) ?? ''),
    (produto) => comEscolha(produto, 'papel', valores.papel),
  );
}

/** Os produtos seguem a ordem do formulário e preservam a origem mesmo com atos repetidos. */
export function comProdutos<T extends { readonly produtos?: readonly Produto[] }>(
  parte: T,
  produtos: readonly ProdutoDoFormulario[],
): T {
  return comLista(
    parte,
    'produtos',
    itensEditadosPorOrigem(parte.produtos, produtos, produtoComValores),
  );
}

/** Declarar que emite parecer individual e declarar que não emite são decisões; vazio é "não decidido". */
export function comParecerIndividual<T extends { readonly emiteParecerIndividual?: boolean }>(
  parte: T,
  emite: boolean | null,
): T {
  return comCampo(parte, 'emiteParecerIndividual', emite ?? undefined);
}

/**
 * Os tipos de decisão, na ordem do formulário. O código que o vocabulário do documento não conhece
 * e que o documento ainda não tinha não entra; o que ele já tinha continua, para a pessoa poder
 * retirá-lo.
 */
export function comTiposDeDecisao<
  T extends { readonly tiposDeDecisao?: readonly TipoDeDecisaoDoDocumento[] },
>(parte: T, codigos: readonly string[]): T {
  const declarados = parte.tiposDeDecisao ?? [];
  const tipos = codigos.flatMap((codigo) => {
    const jaDeclarado = declarados.find((declarado) => declarado === codigo);
    return jaDeclarado ?? membroDoEnum(TipoDeDecisaoDoDocumento, codigo) ?? [];
  });
  return comLista(parte, 'tiposDeDecisao', tipos);
}
