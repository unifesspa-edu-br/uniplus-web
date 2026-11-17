import type {
  AplicabilidadeDaExigencia,
  ConsequenciaDoIndeferimento,
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoExigencia,
  DocumentoDaConfiguracaoPredicado,
  FinalidadeDaExigencia,
} from '@uniplus/shared-data/selecao';

import { novaChave } from '../../shared/chaves/chave-local';
import { chavesTomadas, type ReservasDeChaves } from '../chaves-tomadas';
import { inteiroQueVale, textoQueVale } from '../valor-que-vale';
import {
  comBasesLegais,
  comFormatosPermitidos,
  comIdadeMaximaDeEmissao,
  type BaseLegalDoFormulario,
  type FormatosDoFormulario,
  type IdadeMaximaDoFormulario,
} from './condicoes-da-exigencia.edicao';
import { comAlteracoes, partesAlteradas } from './partes-por-chave';
import { comCampo, comCodigo, comEscolha, comLista, naSecao } from './secao-do-documento';

type Exigencia = DocumentoDaConfiguracaoExigencia;

/**
 * A exigência como o formulário a tem. A condição de gatilho vai como o predicado do documento,
 * que o editor de condições produz; `null` é exigência sem gatilho.
 */
export interface ExigenciaDoFormulario {
  readonly origem?: number;
  readonly chave: string;
  readonly tipoDocumentoCodigo: string;
  readonly faseChave: string;
  readonly etapaChave: string;
  readonly finalidade: FinalidadeDaExigencia | '';
  readonly aplicabilidade: AplicabilidadeDaExigencia | '';
  readonly obrigatorio: boolean | null;
  readonly consequenciaIndeferimento: ConsequenciaDoIndeferimento | '';
  readonly condicaoGatilho: DocumentoDaConfiguracaoPredicado | null;
  readonly tamanhoMaximoBytes: string;
  readonly basesLegais: readonly BaseLegalDoFormulario[];
  readonly idadeMaximaEmissao: IdadeMaximaDoFormulario | null;
  readonly formatosPermitidos: FormatosDoFormulario | null;
}

/** O que o catálogo diz do tipo de documento: sai junto com o código, e a API o recalcula. */
const DESCRITIVOS_DO_TIPO_DE_DOCUMENTO = [
  'tipoDocumentoNome',
  'tipoDocumentoCategoria',
  'classificacaoProtecao',
  'finalidadeTratamento',
  'hipoteseLegal',
  'fatosComprovados',
] as const;

function lugarDaExigencia(exigencia: Exigencia, valores: ExigenciaDoFormulario): Exigencia {
  return comAlteracoes(
    exigencia,
    (atual) =>
      comCodigo(
        atual,
        'tipoDocumentoCodigo',
        textoQueVale(atual.tipoDocumentoCodigo, valores.tipoDocumentoCodigo),
        DESCRITIVOS_DO_TIPO_DE_DOCUMENTO,
      ),
    (atual) => comCampo(atual, 'faseChave', textoQueVale(atual.faseChave, valores.faseChave)),
    (atual) => comCampo(atual, 'etapaChave', textoQueVale(atual.etapaChave, valores.etapaChave)),
    (atual) => comEscolha(atual, 'finalidade', valores.finalidade),
  );
}

function regraDaExigencia(exigencia: Exigencia, valores: ExigenciaDoFormulario): Exigencia {
  return comAlteracoes(
    exigencia,
    (atual) => comEscolha(atual, 'aplicabilidade', valores.aplicabilidade),
    (atual) => comCampo(atual, 'obrigatorio', valores.obrigatorio ?? undefined),
    (atual) => comEscolha(atual, 'consequenciaIndeferimento', valores.consequenciaIndeferimento),
    (atual) => comCampo(atual, 'condicaoGatilho', valores.condicaoGatilho ?? undefined),
    (atual) =>
      comCampo(
        atual,
        'tamanhoMaximoBytes',
        inteiroQueVale(atual.tamanhoMaximoBytes, valores.tamanhoMaximoBytes),
      ),
  );
}

function exigenciaComValores(atual: Exigencia, valores: ExigenciaDoFormulario): Exigencia {
  return comAlteracoes(
    atual,
    (exigencia) => lugarDaExigencia(exigencia, valores),
    (exigencia) => regraDaExigencia(exigencia, valores),
    (exigencia) => comBasesLegais(exigencia, valores.basesLegais),
    (exigencia) => comIdadeMaximaDeEmissao(exigencia, valores.idadeMaximaEmissao),
    (exigencia) => comFormatosPermitidos(exigencia, valores.formatosPermitidos),
  );
}

/**
 * As exigências, na ordem do formulário; a que ele deixa de trazer sai. A árvore de satisfação não
 * é tocada: o nó que cita a exigência retirada segue citando a chave dela até o diagnóstico da API
 * apontá-lo.
 */
export function definirExigencias(
  documento: DocumentoDaConfiguracao,
  exigencias: readonly ExigenciaDoFormulario[],
): DocumentoDaConfiguracao {
  return naSecao(documento, 'documentosExigidos', (secao) =>
    comLista(
      secao,
      'exigencias',
      partesAlteradas(secao.exigencias ?? [], exigencias, exigenciaComValores),
    ),
  );
}

function chaveDaNovaExigencia(
  documento: DocumentoDaConfiguracao,
  exigencias: readonly Exigencia[],
  nome: string,
  reservas: ReservasDeChaves,
): string {
  const doMesmoTipo = exigencias.map((exigencia) => exigencia.chave);
  return novaChave({
    tipo: 'exigencia',
    nome,
    tomadas: chavesTomadas(documento, doMesmoTipo, reservas),
  });
}

/** A exigência nova vai ao fim, com a chave atribuída aqui, a partir do nome do tipo de documento. */
export function acrescentarExigencia(
  documento: DocumentoDaConfiguracao,
  tipoDocumentoCodigo: string,
  nome: string,
  reservas: ReservasDeChaves,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'documentosExigidos', (secao) => {
    const exigencias = secao.exigencias ?? [];
    const chave = chaveDaNovaExigencia(documento, exigencias, nome, reservas);
    return comCampo(secao, 'exigencias', [...exigencias, { chave, tipoDocumentoCodigo }]);
  });
}
