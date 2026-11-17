import { HttpEventType, HttpHeaders, type HttpContext } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { type Mock, expect, vi } from 'vitest';
import { SignedUploadClient } from '@uniplus/shared-core/http';
import { IDEMPOTENCY_KEY_TOKEN } from '@uniplus/shared-core/idempotency';
import { InscricoesApi } from '@uniplus/shared-data/selecao';
import { errorResult, mockProblemDetails, okResult } from '@uniplus/shared-testing';
import type { AlvoDoEnvio, EnvioDeDocumentos } from '@uniplus/shared-ui/components';

import { EnvioDeDocumentosDaInscricao } from './envio-de-documentos-da-inscricao';

export const PROCESSO = 'processo-1';
export const ALVO: AlvoDoEnvio = {
  chave: 'e1:',
  exigenciaId: 'e1',
  ocorrenciaId: null,
  nome: 'Laudo',
};
export const OUTRO_ALVO: AlvoDoEnvio = {
  chave: 'e2:',
  exigenciaId: 'e2',
  ocorrenciaId: null,
  nome: 'Histórico',
};
export const PRAZO_VALIDO = '2999-01-01T00:00:00Z';
export const PRAZO_VENCIDO = '2000-01-01T00:00:00Z';
export const FORMATO_NAO_ACEITO = 'O formato do arquivo não é aceito.';
export const FALHA_NO_ARMAZENAMENTO =
  'Falha ao enviar o arquivo. Verifique a conexão e tente novamente.';
export const ENDERECO_VENCIDO =
  'O endereço de envio não é mais válido. Tente novamente para obter um novo.';

export const DESTINO = {
  arquivoId: 'arquivo-1',
  apresentacaoId: 'apresentacao-1',
  urlUpload: 'http://storage/laudo',
  contentTypeExigido: 'application/pdf',
  expiraEm: PRAZO_VALIDO,
};

export const CONFIRMADO = {
  arquivoId: 'arquivo-1',
  apresentacaoId: 'apresentacao-1',
  exigenciaId: 'e1',
  ocorrenciaId: null,
  tipoDeMidia: 'application/pdf',
  tamanhoBytes: 7,
  hashSha256: 'abc',
  confirmadoEm: '2026-10-20T10:00:00Z',
  rotulo: 'Arquivo 3',
  nomeParaDownload: null,
};

export interface ApiSimulada {
  readonly iniciarEnvioDeDocumento: Mock;
  readonly confirmarEnvioDeDocumento: Mock;
  readonly removerArquivoDeDocumento: Mock;
  readonly obterAcessoDoArquivo: Mock;
}

export function criarApiSimulada(): ApiSimulada {
  return {
    iniciarEnvioDeDocumento: vi.fn(),
    confirmarEnvioDeDocumento: vi.fn(),
    removerArquivoDeDocumento: vi.fn(),
    obterAcessoDoArquivo: vi.fn(),
  };
}

export function respostaDoArmazenamento(etag: string | null = '"abc123"'): Observable<unknown> {
  const headers = etag === null ? new HttpHeaders() : new HttpHeaders({ ETag: etag });
  return of({ type: HttpEventType.Response, headers });
}

/** O armazenamento recusa ou some: o PUT termina em erro HTTP, com o status (0 é rede fora do ar). */
export function falhaDoArmazenamento(status: number): Observable<never> {
  return throwError(() => ({ status }));
}

export function falhaDaApi(status: number, code?: string): ReturnType<typeof errorResult> {
  const problema = mockProblemDetails(code === undefined ? { status } : { status, code });
  return errorResult(problema);
}

export function destinoComPrazo(expiraEm: string, numero = 1): typeof DESTINO {
  return {
    ...DESTINO,
    arquivoId: `arquivo-${numero}`,
    urlUpload: `http://storage/laudo-${numero}`,
    expiraEm,
  };
}

export function prepararCaminhoFeliz(api: ApiSimulada, upload: { enviar: Mock }): void {
  api.iniciarEnvioDeDocumento.mockReturnValue(of(okResult(DESTINO)));
  api.confirmarEnvioDeDocumento.mockReturnValue(of(okResult(CONFIRMADO)));
  upload.enviar.mockReturnValue(respostaDoArmazenamento());
}

export function configurarEnvio(api: ApiSimulada, upload: { enviar: Mock }): void {
  TestBed.configureTestingModule({
    providers: [
      EnvioDeDocumentosDaInscricao,
      { provide: InscricoesApi, useValue: api },
      { provide: SignedUploadClient, useValue: upload },
    ],
  });
}

export function envioDoProcesso(): EnvioDeDocumentos {
  return TestBed.inject(EnvioDeDocumentosDaInscricao).paraOProcesso(PROCESSO);
}

/**
 * A Idempotency-Key de cada chamada do cliente da API; o contexto é sempre o último argumento.
 * Falha se o número de chamadas não for o esperado ou se alguma sair sem chave.
 */
export function chavesEnviadas(chamadas: Mock, esperadas: number): string[] {
  expect(chamadas.mock.calls).toHaveLength(esperadas);
  const chaves = chamadas.mock.calls.map((chamada) =>
    (chamada[chamada.length - 1] as HttpContext).get(IDEMPOTENCY_KEY_TOKEN),
  );
  chaves.forEach((chave) => expect(chave).toEqual(expect.any(String)));
  chaves.forEach((chave) => expect(chave).not.toBe(''));
  return chaves as string[];
}

/** Quantas chamadas à API estão abertas ao mesmo tempo e qual foi o máximo observado. */
export interface Concorrencia {
  ativas: number;
  maxima: number;
  chamadas: number;
}

/** Resposta que chega num turno seguinte, para que chamadas sobrepostas apareçam como simultâneas. */
export function respostaLenta<T>(valor: T, concorrencia: Concorrencia): Observable<T> {
  return new Observable<T>((assinante) => {
    concorrencia.ativas++;
    concorrencia.chamadas++;
    concorrencia.maxima = Math.max(concorrencia.maxima, concorrencia.ativas);
    const temporizador = setTimeout(() => {
      concorrencia.ativas--;
      assinante.next(valor);
      assinante.complete();
    }, 0);
    return () => clearTimeout(temporizador);
  });
}

/** Todas as chamadas da API respondem com sucesso, mas num turno seguinte; devolve a medição. */
export function responderDevagar(api: ApiSimulada): Concorrencia {
  const medida: Concorrencia = { ativas: 0, maxima: 0, chamadas: 0 };
  api.iniciarEnvioDeDocumento.mockImplementation(() => respostaLenta(okResult(DESTINO), medida));
  api.confirmarEnvioDeDocumento.mockImplementation(() =>
    respostaLenta(okResult(CONFIRMADO), medida),
  );
  api.removerArquivoDeDocumento.mockImplementation(() =>
    respostaLenta(okResult(undefined), medida),
  );
  return medida;
}
