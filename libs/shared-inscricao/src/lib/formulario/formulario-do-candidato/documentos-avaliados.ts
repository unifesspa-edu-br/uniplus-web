import type { DocumentoExigido } from '../lista-de-documentos/lista-de-documentos';
import {
  type ArquivoEnviado,
  emVerificacao,
  type SituacaoDaExigencia,
  type SituacaoDoArquivo,
} from './envio-de-documentos';
import type { PendenciaDaAvaliacao } from './modalidades-avaliadas';

/** Todos os itens do grupo são pedidos juntos. */
export const TODOS_OS_ITENS = 'TODOS_OS_ITENS';
/** Basta apresentar `minimo` dos itens do grupo — um, se o mínimo não vier. */
export const QUANTIDADE_MINIMA_DE_ITENS = 'QUANTIDADE_MINIMA_DE_ITENS';

/** Um grupo da estrutura de regras de exigências que contém o documento. */
export interface GrupoDoDocumento {
  readonly grupoId: string;
  /** `E` ou `OU`. */
  readonly forma: { readonly codigo: string; readonly rotulo: string };
  /** Quantos itens do `OU` bastam; nulo no `E`. */
  readonly minimo: number | null;
  /** O grupo de integrantes pelo qual este regra se repete: a escolha dele é feita integrante a integrante. */
  readonly grupoDoFormularioParaRepeticao: string | null;
}

/** Um arquivo já confirmado para a exigência, como a avaliação o devolve. */
export interface ArquivoDoDocumento {
  readonly arquivoId: string;
  readonly apresentacaoId: string;
  readonly tipoDeMidia: string;
  readonly tamanhoBytes: number | null;
  readonly situacao: SituacaoDoArquivo;
  readonly mensagem: string | null;
  readonly rotulo: string;
  readonly confirmadoEm: string;
}

/** Uma exigência documental diante das respostas do candidato, como a API a calcula (ADR-0143). */
export interface DocumentoAvaliado {
  readonly exigenciaId: string;
  readonly nome: string;
  readonly obrigatorio: boolean;
  /** O código do formulário em que o documento é apresentado. */
  readonly formularioCodigo: string | null;
  readonly formatos: DocumentoExigido['formatos'];
  readonly modelo: DocumentoExigido['modelo'];
  /** Os formatos que o envio aceita para a exigência (PDF, JPEG, PNG). */
  readonly formatosAceitos: readonly string[];
  /** O menor limite de tamanho efetivo entre os formatos aceitos. */
  readonly tamanhoMaximoBytes: number;
  /** Quantas apresentações a exigência pede, no mínimo. */
  readonly quantidadeMinima: number;
  /** Os arquivos confirmados desta exigência e ocorrência. */
  readonly arquivos: readonly ArquivoDoDocumento[];
  readonly situacao: Pick<SituacaoDaExigencia, 'rotulo' | 'variante'>;
  readonly exigido: boolean;
  readonly atendido: boolean;
  /** O grupo pelo qual a exigência se repete, uma vez por integrante; nulo fora de repetição. */
  readonly grupoCodigo: string | null;
  /** A ocorrência do grupo a que a exigência se liga; nula enquanto não se sabe quais integrantes há. */
  readonly ocorrenciaId: string | null;
  /**
   * Os grupos da estrutura de regras que contêm a exigência, do mais externo ao mais interno. Documentos com o mesmo
   * grupo estão nele juntos.
   */
  readonly grupos: readonly GrupoDoDocumento[];
  /** O grupo de integrantes pelo qual a própria exigência se repete, quando a repetição começa nela. */
  readonly grupoDoFormularioParaRepeticao: string | null;
}

/** Uma fase do cronograma: os documentos dela e o que falta responder para decidir os que podem ser pedidos. */
export interface FaseDosDocumentosAvaliados {
  readonly faseId: string;
  readonly codigo: string;
  readonly ordem: number;
  readonly documentos: readonly DocumentoAvaliado[];
  readonly pendencias: readonly PendenciaDaAvaliacao[];
}

export interface DocumentosAvaliados {
  readonly fases: readonly FaseDosDocumentosAvaliados[];
}

/** O que o formulário mostra da avaliação dos documentos: os da fase e do código dele. */
export interface DocumentosDoFormulario {
  readonly documentos: readonly DocumentoAvaliado[];
  readonly pendencias: readonly PendenciaDaAvaliacao[];
}

/**
 * Os documentos que se apresentam no próprio formulário: os da fase dele e, nela, os do código
 * dele — cada formulário da mesma fase apresenta os seus. As pendências são as da fase. Sem a fase do
 * formulário, nada se mostra.
 */
export function documentosDoFormulario(
  documentos: DocumentosAvaliados,
  faseId: string | null | undefined,
  formularioCodigo: string | null | undefined,
): DocumentosDoFormulario {
  const fase = faseId ? documentos.fases.find((f) => f.faseId === faseId) : undefined;
  return {
    documentos: formularioCodigo
      ? (fase?.documentos.filter((d) => d.formularioCodigo === formularioCodigo) ?? [])
      : [],
    pendencias: fase?.pendencias ?? [],
  };
}

/** A chave da exigência e da ocorrência, que liga o envio, a situação e os arquivos dela. */
export function chaveDaExigencia(
  documento: Pick<DocumentoAvaliado, 'exigenciaId' | 'ocorrenciaId'>,
): string {
  return `${documento.exigenciaId}:${documento.ocorrenciaId ?? ''}`;
}

/**
 * Da avaliação da API, a situação de cada exigência que já se aplica (pendente ou satisfeita) e os
 * arquivos já confirmados, ambos pela chave da exigência e da ocorrência.
 */
export function situacoesEArquivosDosDocumentos(documentos: readonly DocumentoAvaliado[]): {
  readonly situacoes: Readonly<Record<string, SituacaoDaExigencia>>;
  readonly arquivos: readonly ArquivoEnviado[];
} {
  const situacoes: Record<string, SituacaoDaExigencia> = {};
  for (const documento of documentos) {
    if (documento.exigido) {
      situacoes[chaveDaExigencia(documento)] = {
        ...documento.situacao,
        atendido: documento.atendido,
      };
    }
  }
  return { situacoes, arquivos: documentos.flatMap(arquivosDoDocumento) };
}

function arquivosDoDocumento(documento: DocumentoAvaliado): readonly ArquivoEnviado[] {
  const chave = chaveDaExigencia(documento);
  return documento.arquivos.map((arquivo) => ({
    arquivoId: arquivo.arquivoId,
    apresentacaoId: arquivo.apresentacaoId,
    chave,
    tipoDeMidia: arquivo.tipoDeMidia,
    tamanhoBytes: arquivo.tamanhoBytes,
    situacao: arquivo.situacao,
    mensagem: arquivo.mensagem,
    rotulo: arquivo.rotulo,
    confirmadoEm: arquivo.confirmadoEm,
  }));
}

/** O que o candidato lê quando a inscrição não pode seguir porque há documento obrigatório em verificação (UNI-REQ-0028). */
export const AGUARDE_A_VERIFICACAO =
  'Aguarde a verificação completa dos documentos obrigatórios para enviar a inscrição.';

/** Se algum arquivo, de qualquer exigência, ainda espera o resultado da verificação. */
export function haArquivoEmVerificacao(documentos: readonly DocumentoAvaliado[]): boolean {
  return documentos.some((documento) =>
    documento.arquivos.some((arquivo) => emVerificacao(arquivo.situacao)),
  );
}

/**
 * Se algum documento obrigatório tem arquivo em verificação e nenhum verificado: a API só deixa enviar a
 * inscrição depois do resultado. Uma apresentação conta uma vez, qualquer que seja o número de arquivos
 * (frente e verso), e basta um arquivo verificado para ela deixar de esperar.
 */
export function aguardaVerificacaoDeObrigatorio(documentos: readonly DocumentoAvaliado[]): boolean {
  return documentos.some((documento) => {
    if (!documento.obrigatorio) return false;
    const verificadas = new Set(
      documento.arquivos.filter((a) => a.situacao === 'VERIFICADO').map((a) => a.apresentacaoId),
    );
    return documento.arquivos.some(
      (a) => emVerificacao(a.situacao) && !verificadas.has(a.apresentacaoId),
    );
  });
}
