import {
  DocumentoDaConfiguracaoIdentificacaoOrigemCandidatos as OrigemDosCandidatos,
  type DocumentoDaConfiguracao,
} from '@uniplus/shared-data/selecao';

import { referenciaQueVale, type RegraEscolhida } from '../regra-escolhida';
import { textoQueVale } from '../valor-que-vale';
import { comCampo, comCodigo, naSecao } from './secao-do-documento';

export function definirTipoDoProcesso(
  documento: DocumentoDaConfiguracao,
  codigo: string,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'identificacao', (identificacao) =>
    comCodigo(
      identificacao,
      'tipoProcessoCodigo',
      textoQueVale(identificacao.tipoProcessoCodigo, codigo),
      ['tipoProcessoNome'],
    ),
  );
}

export function definirNome(
  documento: DocumentoDaConfiguracao,
  nome: string,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'identificacao', (identificacao) =>
    comCampo(identificacao, 'nome', textoQueVale(identificacao.nome, nome)),
  );
}

export function definirUnidadeAdministradora(
  documento: DocumentoDaConfiguracao,
  codigo: string,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'identificacao', (identificacao) =>
    comCodigo(
      identificacao,
      'unidadeAdministradoraCodigo',
      textoQueVale(identificacao.unidadeAdministradoraCodigo, codigo),
      ['unidadeAdministradoraNome', 'unidadeAdministradoraSigla'],
    ),
  );
}

export function definirOrigemDosCandidatos(
  documento: DocumentoDaConfiguracao,
  origem: OrigemDosCandidatos | '',
): DocumentoDaConfiguracao {
  return naSecao(documento, 'identificacao', (identificacao) =>
    comCampo(identificacao, 'origemCandidatos', origem === '' ? undefined : origem),
  );
}

/** Só o código do município entra: nome e UF são descritivos que a API devolve. */
export function definirLocalidade(
  documento: DocumentoDaConfiguracao,
  codigoIbge: string,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'identificacao', (identificacao) =>
    comCodigo(
      identificacao,
      'localidadeCodigoIbge',
      textoQueVale(identificacao.localidadeCodigoIbge, codigoIbge),
      ['localidadeNome', 'localidadeUf'],
    ),
  );
}

export function definirIdentificadorLegivel(
  documento: DocumentoDaConfiguracao,
  identificador: string,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'identificacao', (identificacao) =>
    comCampo(
      identificacao,
      'identificadorLegivel',
      textoQueVale(identificacao.identificadorLegivel, identificador),
    ),
  );
}

/** A convenção de contagem de prazo do catálogo; é do bloco da identificação, escolhida no cronograma. */
export function definirConvencaoDeContagem(
  documento: DocumentoDaConfiguracao,
  regra: RegraEscolhida | null,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'identificacao', (identificacao) =>
    comCampo(
      identificacao,
      'algoritmoContagemPrazo',
      referenciaQueVale(identificacao.algoritmoContagemPrazo, regra),
    ),
  );
}
