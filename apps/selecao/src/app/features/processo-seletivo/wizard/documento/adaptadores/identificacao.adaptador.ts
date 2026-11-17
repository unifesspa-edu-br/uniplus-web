import {
  DocumentoDaConfiguracaoIdentificacaoOrigemCandidatos as OrigemDosCandidatos,
  type DocumentoDaConfiguracao,
  type DocumentoDaConfiguracaoIdentificacao,
} from '@uniplus/shared-data/selecao';
import { rotuloDaUnidade } from '@uniplus/shared-data/organizacao';

import { rotuloDoCodigo, type CatalogoPorCodigo } from '../catalogos-por-codigo';
import {
  definirIdentificadorLegivel,
  definirLocalidade,
  definirNome,
  definirOrigemDosCandidatos,
  definirUnidadeAdministradora,
} from '../edicoes/identificacao.edicao';
import { emSequencia, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';

export interface UnidadeEscolhida {
  readonly codigo: string;
  readonly rotulo: string;
}

/** O município escolhido: só o código vai ao documento; nome e UF são o que a API devolveu. */
export interface MunicipioEscolhido {
  readonly codigoIbge: string;
  readonly nome?: string;
  readonly uf?: string;
}

export interface ValoresDaIdentificacao {
  readonly nome: string;
  readonly unidade: UnidadeEscolhida | null;
  /** Vazio é "ainda não escolhida". */
  readonly origem: OrigemDosCandidatos | '';
  readonly localidade: MunicipioEscolhido | null;
  readonly identificadorLegivel: string;
}

export interface CatalogosDaIdentificacao {
  readonly unidades: CatalogoPorCodigo;
}

export function valoresDoFormulario(
  documento: DocumentoDaConfiguracao,
  catalogos: CatalogosDaIdentificacao,
): ValoresDaIdentificacao {
  const identificacao = documento.identificacao ?? {};
  return {
    nome: identificacao.nome ?? '',
    unidade: unidadeDe(identificacao, catalogos.unidades),
    origem: identificacao.origemCandidatos ?? '',
    localidade: municipioDe(identificacao),
    identificadorLegivel: identificacao.identificadorLegivel ?? '',
  };
}

function unidadeDe(
  identificacao: DocumentoDaConfiguracaoIdentificacao,
  catalogo: CatalogoPorCodigo,
): UnidadeEscolhida | null {
  const codigo = identificacao.unidadeAdministradoraCodigo;
  if (codigo === undefined) return null;
  const { unidadeAdministradoraSigla: sigla, unidadeAdministradoraNome: nome } = identificacao;
  const gravado =
    sigla === undefined || nome === undefined ? undefined : rotuloDaUnidade({ sigla, nome });
  return { codigo, rotulo: rotuloDoCodigo(catalogo, codigo, gravado) };
}

function municipioDe(
  identificacao: DocumentoDaConfiguracaoIdentificacao,
): MunicipioEscolhido | null {
  const {
    localidadeCodigoIbge: codigoIbge,
    localidadeNome: nome,
    localidadeUf: uf,
  } = identificacao;
  return codigoIbge === undefined ? null : { codigoIbge, nome, uf };
}

export function edicaoDoPasso(valores: ValoresDaIdentificacao): EdicaoDoDocumento {
  return emSequencia(
    (documento) => definirNome(documento, valores.nome),
    (documento) => definirUnidadeAdministradora(documento, valores.unidade?.codigo ?? ''),
    (documento) => definirOrigemDosCandidatos(documento, valores.origem),
    (documento) => definirLocalidade(documento, valores.localidade?.codigoIbge ?? ''),
    (documento) => definirIdentificadorLegivel(documento, valores.identificadorLegivel),
  );
}
