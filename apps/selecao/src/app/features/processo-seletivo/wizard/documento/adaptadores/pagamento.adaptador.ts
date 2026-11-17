import {
  type DocumentoDaConfiguracao,
  type DocumentoDaConfiguracaoTaxaDeInscricaoFundamentos as Fundamento,
} from '@uniplus/shared-data/selecao';

import { formatarValorEmReais } from '../../shared/valor-em-reais';
import {
  definirCobranca,
  definirFundamentosDeIsencao,
  definirValorDaTaxa,
} from '../edicoes/taxa-de-inscricao.edicao';
import { emSequencia, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';

export interface ValoresDoPagamento {
  /** `null` é "ainda não declarado": ausente não é o mesmo que "não cobra". */
  readonly cobra: boolean | null;
  readonly valor: string;
  readonly fundamentos: readonly Fundamento[];
}

export function valoresDoFormulario(documento: DocumentoDaConfiguracao): ValoresDoPagamento {
  const taxa = documento.taxaDeInscricao ?? {};
  return {
    cobra: taxa.cobra ?? null,
    valor: taxa.valor === undefined ? '' : formatarValorEmReais(taxa.valor),
    fundamentos: taxa.fundamentos ?? [],
  };
}

/** A cobrança é a última a valer: declarar que não cobra tira o valor e os fundamentos. */
export function edicaoDoPasso(valores: ValoresDoPagamento): EdicaoDoDocumento {
  return emSequencia(
    (documento) => definirValorDaTaxa(documento, valores.valor),
    (documento) => definirFundamentosDeIsencao(documento, valores.fundamentos),
    (documento) => definirCobranca(documento, valores.cobra),
  );
}
