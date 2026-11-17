import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoExigencia,
} from '@uniplus/shared-data/selecao';

import { rotuloDoCodigo, type CatalogoPorCodigo } from '../catalogos-por-codigo';
import type { NoDoFormulario } from '../edicoes/arvore-de-satisfacao.edicao';
import { definirArvoreDeSatisfacao } from '../edicoes/arvore-de-satisfacao.edicao';
import { definirExigencias, type ExigenciaDoFormulario } from '../edicoes/exigencias.edicao';
import { emSequencia, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';
import { textoDoNumero } from '../texto-do-campo';
import {
  baseLegalDoFormulario,
  formatosDoFormulario,
  idadeMaximaDoFormulario,
  noDoFormulario,
} from './leituras-das-exigencias';

/** A exigência como o passo a mostra: os valores editáveis e o nome do tipo de documento. */
export interface ExigenciaDoPasso extends ExigenciaDoFormulario {
  readonly tipoDocumentoRotulo: string;
}

/**
 * As exigências ficam planas, cada uma com a sua chave, e a árvore de satisfação as cita por essa
 * chave: o documento é assim, e o adaptador não junta uma coisa na outra.
 */
export interface ValoresDasExigencias {
  readonly exigencias: readonly ExigenciaDoPasso[];
  readonly arvoreDeSatisfacao: readonly NoDoFormulario[];
}

export interface CatalogosDasExigencias {
  readonly tiposDeDocumento: CatalogoPorCodigo;
}

type Lugar = Pick<
  ExigenciaDoPasso,
  | 'chave'
  | 'tipoDocumentoCodigo'
  | 'tipoDocumentoRotulo'
  | 'faseChave'
  | 'etapaChave'
  | 'finalidade'
>;

function lugarDe(exigencia: DocumentoDaConfiguracaoExigencia, catalogo: CatalogoPorCodigo): Lugar {
  const tipoDocumentoCodigo = exigencia.tipoDocumentoCodigo ?? '';
  return {
    chave: exigencia.chave,
    tipoDocumentoCodigo,
    tipoDocumentoRotulo: rotuloDoCodigo(catalogo, tipoDocumentoCodigo, exigencia.tipoDocumentoNome),
    faseChave: exigencia.faseChave ?? '',
    etapaChave: exigencia.etapaChave ?? '',
    finalidade: exigencia.finalidade ?? '',
  };
}

type Regra = Pick<
  ExigenciaDoPasso,
  | 'aplicabilidade'
  | 'obrigatorio'
  | 'consequenciaIndeferimento'
  | 'condicaoGatilho'
  | 'tamanhoMaximoBytes'
>;

function regraDe(exigencia: DocumentoDaConfiguracaoExigencia): Regra {
  return {
    aplicabilidade: exigencia.aplicabilidade ?? '',
    obrigatorio: exigencia.obrigatorio ?? null,
    consequenciaIndeferimento: exigencia.consequenciaIndeferimento ?? '',
    condicaoGatilho: exigencia.condicaoGatilho ?? null,
    tamanhoMaximoBytes: textoDoNumero(exigencia.tamanhoMaximoBytes),
  };
}

function exigenciaDe(
  exigencia: DocumentoDaConfiguracaoExigencia,
  catalogo: CatalogoPorCodigo,
): ExigenciaDoPasso {
  return {
    ...lugarDe(exigencia, catalogo),
    ...regraDe(exigencia),
    basesLegais: (exigencia.basesLegais ?? []).map(baseLegalDoFormulario),
    idadeMaximaEmissao: idadeMaximaDoFormulario(exigencia.idadeMaximaEmissao),
    formatosPermitidos: formatosDoFormulario(exigencia.formatosPermitidos),
  };
}

export function valoresDoFormulario(
  documento: DocumentoDaConfiguracao,
  catalogos: CatalogosDasExigencias,
): ValoresDasExigencias {
  const secao = documento.documentosExigidos;
  return {
    exigencias: (secao?.exigencias ?? []).map((exigencia, origem) => ({
      ...exigenciaDe(exigencia, catalogos.tiposDeDocumento),
      origem,
    })),
    arvoreDeSatisfacao: (secao?.arvoreDeSatisfacao ?? []).map(noDoFormulario),
  };
}

export function edicaoDoPasso(valores: ValoresDasExigencias): EdicaoDoDocumento {
  return emSequencia(
    (documento) => definirExigencias(documento, valores.exigencias),
    (documento) => definirArvoreDeSatisfacao(documento, valores.arvoreDeSatisfacao),
  );
}
