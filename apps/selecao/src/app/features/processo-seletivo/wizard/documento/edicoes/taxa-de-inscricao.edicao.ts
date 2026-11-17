import {
  type DocumentoDaConfiguracao,
  type DocumentoDaConfiguracaoTaxaDeInscricaoFundamentos as Fundamento,
} from '@uniplus/shared-data/selecao';

import { valorEmReaisQueVale } from '../valor-que-vale';
import { comCampo, comLista, naSecao } from './secao-do-documento';

/**
 * Sem resposta, a cobrança some do documento: ausente não é "não cobra". Declarar que não cobra
 * leva junto o valor e os fundamentos, que a tela esconde nesse caso e que a API recusaria.
 */
export function definirCobranca(
  documento: DocumentoDaConfiguracao,
  cobra: boolean | null,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'taxaDeInscricao', (taxa) => {
    const declarada = comCampo(taxa, 'cobra', cobra ?? undefined);
    return cobra === false && taxa.cobra !== false
      ? comCampo(comCampo(declarada, 'valor', undefined), 'fundamentos', undefined)
      : declarada;
  });
}

/** O valor em reais, no texto que o campo aceita; o que não é valor não entra no documento. */
export function definirValorDaTaxa(
  documento: DocumentoDaConfiguracao,
  texto: string,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'taxaDeInscricao', (taxa) =>
    comCampo(taxa, 'valor', valorEmReaisQueVale(taxa.valor, texto)),
  );
}

/**
 * Esvaziar a lista que estava ausente não a declara: ausente é "ainda não decidiu". Quem decidiu
 * que o processo não reconhece fundamento de isenção declara isso aqui.
 */
export function declararSemFundamentosDeIsencao(
  documento: DocumentoDaConfiguracao,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'taxaDeInscricao', (taxa) => comCampo(taxa, 'fundamentos', []));
}

export function definirFundamentosDeIsencao(
  documento: DocumentoDaConfiguracao,
  fundamentos: readonly Fundamento[],
): DocumentoDaConfiguracao {
  return naSecao(documento, 'taxaDeInscricao', (taxa) =>
    comLista(taxa, 'fundamentos', [...new Set(fundamentos)]),
  );
}

export function alternarFundamentoDeIsencao(
  documento: DocumentoDaConfiguracao,
  fundamento: Fundamento,
  marcado: boolean,
): DocumentoDaConfiguracao {
  const outros = (documento.taxaDeInscricao?.fundamentos ?? []).filter(
    (item) => item !== fundamento,
  );
  return definirFundamentosDeIsencao(documento, marcado ? [...outros, fundamento] : outros);
}
