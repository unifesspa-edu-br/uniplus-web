import { conteudoDoDocumento } from '../formulario/conversao-do-formulario';
import type { CatalogosDaConversaoDoFormulario } from '../formulario/resultado-da-conversao';
import { CamposEmEdicao } from '../formulario/campos-em-edicao';
import type { ResultadoDaConversaoDoFormulario } from '../formulario/resultado-da-conversao';
import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoColeta,
  DocumentoDaConfiguracaoFormulario,
  FinalidadeDoFormulario,
} from '@uniplus/shared-data/selecao';

import {
  definirReferenciaTemporal,
  type ReferenciaTemporalDoFormulario,
} from '../edicoes/coleta.edicao';
import {
  definirFaseDoFormulario,
  definirTitulo,
  formularioDaFinalidade,
  noFormulario,
} from '../edicoes/formulario.edicao';
import { emSequencia, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';

/**
 * O que o passo mostra do cabeçalho do formulário de uma finalidade. O conteúdo (etapas, itens,
 * grupos e termos) não passa por aqui: voltam como estão, e têm as edições próprias.
 */
export interface ValoresDoFormulario {
  readonly titulo: string;
  readonly faseChave: string;
  /** Só leitura: o modelo de que a cópia veio. */
  readonly modeloOrigemCodigo: string;
}

export interface ValoresDoPasso {
  readonly formulario: ValoresDoFormulario;
  readonly referenciaTemporal: ReferenciaTemporalDoFormulario | null;
}

function referenciaDe(
  referencia: NonNullable<DocumentoDaConfiguracaoColeta['referenciaTemporalDosDados']> | undefined,
): ReferenciaTemporalDoFormulario | null {
  if (referencia === undefined) return null;
  return {
    tipo: referencia.tipo ?? '',
    data: referencia.data ?? '',
    faseChave: referencia.faseChave ?? '',
  };
}

function cabecalhoDe(formulario: DocumentoDaConfiguracaoFormulario): ValoresDoFormulario {
  return {
    titulo: formulario.titulo ?? '',
    faseChave: formulario.faseChave ?? '',
    modeloOrigemCodigo: formulario.modeloOrigemCodigo ?? '',
  };
}

/** Os valores do formulário da finalidade, ou `undefined` quando o documento não tem esse formulário. */
export function valoresDoFormulario(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeDoFormulario,
  ocorrencia = 0,
): ValoresDoPasso | undefined {
  const formulario = formularioDaFinalidade(documento, finalidade, ocorrencia);
  if (formulario === undefined) return undefined;
  return {
    formulario: cabecalhoDe(formulario),
    referenciaTemporal: referenciaDe(documento.coleta?.referenciaTemporalDosDados),
  };
}

export function edicaoDoPasso(
  finalidade: FinalidadeDoFormulario,
  valores: ValoresDoPasso,
  ocorrencia = 0,
): EdicaoDoDocumento {
  return emSequencia(
    (documento) => definirTitulo(documento, finalidade, valores.formulario.titulo, ocorrencia),
    (documento) =>
      definirFaseDoFormulario(documento, finalidade, valores.formulario.faseChave, ocorrencia),
    (documento) => definirReferenciaTemporal(documento, valores.referenciaTemporal),
  );
}

export { conteudoDoDocumento, documentoDoConteudo } from '../formulario/conversao-do-formulario';
export type {
  CatalogosDaConversaoDoFormulario,
  ResultadoDaConversaoDoFormulario,
} from '../formulario/resultado-da-conversao';

/** A recusa local não altera nenhuma parte do documento; diagnósticos da API seguem intactos. */
export function edicaoDoConteudo(
  finalidade: FinalidadeDoFormulario,
  conversao: ResultadoDaConversaoDoFormulario,
  ocorrencia = 0,
): EdicaoDoDocumento {
  return (documento) =>
    conversao.ok
      ? noFormulario(
          documento,
          finalidade,
          (formulario) => aplicarConteudo(formulario, conversao),
          ocorrencia,
        )
      : documento;
}

const CAMPOS_DO_CONTEUDO: readonly (keyof DocumentoDaConfiguracaoFormulario)[] = [
  'titulo',
  'paginas',
  'itens',
  'grupos',
  'termos',
];
type ConversaoAceita = Extract<ResultadoDaConversaoDoFormulario, { ok: true }>;

function aplicarConteudo(
  formulario: DocumentoDaConfiguracaoFormulario,
  conversao: ConversaoAceita,
): DocumentoDaConfiguracaoFormulario {
  const edicao = new CamposEmEdicao(conversao.camposEditados);
  return edicao.preservar(formulario, conversao.formulario, CAMPOS_DO_CONTEUDO, []);
}

/** Projeta o conteúdo da ocorrência indicada sem confundir o cabeçalho com os itens do editor. */
export function conteudoDoFormulario(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeDoFormulario,
  catalogos: CatalogosDaConversaoDoFormulario,
  ocorrencia = 0,
): ResultadoDaConversaoDoFormulario | undefined {
  const formulario = formularioDaFinalidade(documento, finalidade, ocorrencia);
  return formulario === undefined ? undefined : conteudoDoDocumento(formulario, catalogos);
}
