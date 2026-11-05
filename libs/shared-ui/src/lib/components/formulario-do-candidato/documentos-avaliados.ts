import type { DocumentoExigido } from '../lista-de-documentos/lista-de-documentos';
import {
  type ArquivoEnviado,
  emVerificacao,
  type SituacaoDaExigencia,
  type SituacaoDoArquivo,
} from './envio-de-documentos';
import type { PendenciaDaAvaliacao } from './modalidades-avaliadas';

/** As respostas dadas já pedem o documento e falta enviar. */
export const PENDENTE = 'PENDENTE';
/** As respostas dadas já pedem o documento e os arquivos enviados o atendem. */
export const SATISFEITA = 'SATISFEITA';
/** As respostas dadas já pedem o documento, pendente ou satisfeito: a lista não distingue os dois. */
export const EXIGIDO = 'EXIGIDO';

/** A situação como a lista a agrupa: pendente e satisfeita são ambas o que já é exigido. */
export function classeDaSituacao(situacao: string): string {
  return situacao === PENDENTE || situacao === SATISFEITA ? EXIGIDO : situacao;
}
/** Uma resposta que ainda falta decide se o documento é pedido. */
export const PODE_SER_EXIGIDO = 'PODE_SER_EXIGIDO';
/** Decide um fato que só se conhece numa fase posterior, como a modalidade da convocação. */
export const DEPENDE_DE_FASE_POSTERIOR = 'DEPENDE_DE_FASE_POSTERIOR';

/** Todos os itens do grupo são pedidos juntos. */
export const GRUPO_E = 'E';
/** Basta apresentar `minimo` dos itens do grupo — um, se o mínimo não vier. */
export const GRUPO_OU = 'OU';

/** Um grupo da árvore de exigências que contém o documento. */
export interface GrupoDoDocumento {
  readonly grupoId: string;
  /** `E` ou `OU`. */
  readonly tipo: string;
  /** Quantos itens do `OU` bastam; nulo no `E`. */
  readonly minimo: number | null;
  /** O grupo de integrantes pelo qual este nó se repete: a escolha dele é feita integrante a integrante. */
  readonly repetePorEntidade: string | null;
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
  /** O formulário em que o documento é apresentado, como `INSCRICAO` ou `ISENCAO_TAXA`. */
  readonly finalidade: string | null;
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
  readonly situacao: string;
  /** O grupo pelo qual a exigência se repete, uma vez por integrante; nulo fora de repetição. */
  readonly grupoCodigo: string | null;
  /** A ocorrência do grupo a que a exigência se liga; nula enquanto não se sabe quais integrantes há. */
  readonly ocorrenciaId: string | null;
  /**
   * Os grupos da árvore que contêm a exigência, do mais externo ao mais interno. Documentos com o mesmo
   * grupo estão nele juntos.
   */
  readonly grupos: readonly GrupoDoDocumento[];
  /** O grupo de integrantes pelo qual a própria exigência se repete, quando a repetição começa nela. */
  readonly repetePorEntidade: string | null;
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

/** O que o formulário mostra da avaliação dos documentos: os da fase e finalidade dele. */
export interface DocumentosDoFormulario {
  readonly documentos: readonly DocumentoAvaliado[];
  readonly pendencias: readonly PendenciaDaAvaliacao[];
}

/**
 * Os documentos que se apresentam no próprio formulário: os da fase dele e, nela, os da finalidade
 * dele — a isenção na mesma fase tem formulário próprio. As pendências são as da fase. Sem a fase do
 * formulário, nada se mostra.
 */
export function documentosDoFormulario(
  documentos: DocumentosAvaliados,
  faseId: string | null | undefined,
  finalidade: string,
): DocumentosDoFormulario {
  const fase = faseId ? documentos.fases.find((f) => f.faseId === faseId) : undefined;
  return {
    documentos: fase?.documentos.filter((d) => d.finalidade === finalidade) ?? [],
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
  const arquivos: ArquivoEnviado[] = [];
  for (const documento of documentos) {
    const chave = chaveDaExigencia(documento);
    if (documento.situacao === PENDENTE || documento.situacao === SATISFEITA) {
      situacoes[chave] = documento.situacao;
    }
    for (const arquivo of documento.arquivos) {
      arquivos.push({
        arquivoId: arquivo.arquivoId,
        apresentacaoId: arquivo.apresentacaoId,
        chave,
        tipoDeMidia: arquivo.tipoDeMidia,
        tamanhoBytes: arquivo.tamanhoBytes,
        situacao: arquivo.situacao,
        mensagem: arquivo.mensagem,
        rotulo: arquivo.rotulo,
        confirmadoEm: arquivo.confirmadoEm,
      });
    }
  }
  return { situacoes, arquivos };
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
      documento.arquivos.filter((a) => a.situacao === 'verificado').map((a) => a.apresentacaoId),
    );
    return documento.arquivos.some(
      (a) => emVerificacao(a.situacao) && !verificadas.has(a.apresentacaoId),
    );
  });
}
