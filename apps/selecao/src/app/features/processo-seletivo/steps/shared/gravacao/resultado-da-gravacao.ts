import { ProblemDetails, STATUS_HTTP } from '@uniplus/shared-core/http';
import type {
  AplicacaoDeModeloDto,
  IniciarEnvioDoDocumentoAPublicarDto,
} from '@uniplus/shared-data/selecao';

/** Recusa nomeada por `ProblemDetails`, para o chamador exibir e decidir o retry. */
export interface FalhaOperacao {
  readonly ok: false;
  readonly problem: ProblemDetails;
}

export type ResultadoCriacao =
  | { readonly ok: true; readonly processoSeletivoId: string }
  | FalhaOperacao;

/** As gravações de configuração respondem 204: não há corpo a devolver. */
export type ResultadoGravacao = { readonly ok: true } | FalhaOperacao;

/**
 * `inconclusiva` diz se a recusa deixou em aberto o comando ter sido executado (rede ou 5xx).
 * Quem chama não pode dar o recurso como ausente do servidor só porque a resposta não chegou.
 */
export type ResultadoGravacaoComInconclusiva =
  | { readonly ok: true }
  | (FalhaOperacao & { readonly inconclusiva: boolean });

export type ResultadoGravacaoCascata = ResultadoGravacaoComInconclusiva;

export type ResultadoIniciacao =
  | { readonly ok: true; readonly iniciacao: IniciarEnvioDoDocumentoAPublicarDto }
  | FalhaOperacao;

export type ResultadoAplicacaoDeModelo =
  | { readonly ok: true; readonly relato: AplicacaoDeModeloDto }
  | (FalhaOperacao & { readonly inconclusiva: boolean });

/** Resultado bruto de `GravacaoDoProcesso`, do qual os `Resultado*` acima são subconjuntos. */
export type ResultadoDaGravacao<T> =
  | { readonly ok: true; readonly dados: T }
  | (FalhaOperacao & { readonly inconclusiva: boolean });

/**
 * Resposta que chegou depois de o editor passar a outro cadastro. Não descreve uma recusa do
 * servidor, por isso não vira mensagem para o operador nem mexe nas chaves do cadastro atual.
 */
export const SUPERADO: ProblemDetails = {
  type: 'about:blank',
  title: 'Operação abandonada ao trocar de processo.',
  status: STATUS_HTTP.CONFLITO,
  code: 'uniplus.client.operacao_superada',
  traceId: '',
};
