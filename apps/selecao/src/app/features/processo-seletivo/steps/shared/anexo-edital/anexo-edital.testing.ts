import { HttpTestingController } from '@angular/common/http/testing';
import { FinalidadeDoDocumento } from '@uniplus/shared-data/selecao';
import { expect } from 'vitest';

import { EtapasDoEnvioDoEdital } from './etapas-do-envio-do-edital';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
export const DOCUMENTO_ID = '01960000-0000-7000-0000-0000000005dd';
export const URL_ASSINADA =
  'http://localhost:9000/uniplus-selecao/editais/edital.pdf?X-Amz-Signature=abc';

export const ROTA_DOCUMENTOS = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/documentos-a-publicar`;
export const URL_LEITURA =
  'http://localhost:9000/uniplus-selecao/editais/confirmado.pdf?X-Amz-Signature=leitura';

/** Um PDF mínimo: a assinatura importa para a recusa client-side. */
export function pdf(nome = 'edital.pdf', bytes = 2048): File {
  return new File([new Uint8Array(bytes).fill(37)], nome, { type: 'application/pdf' });
}

/**
 * Cede o event loop para que a cadeia de `await` do componente avance até a
 * próxima requisição. `Promise.resolve()` sozinho não basta: cada fase do fluxo
 * passa por `firstValueFrom` e por mais de um microtask.
 */
export function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Recusa no formato que a API realmente emite. O `apiResultInterceptor` só
 * parseia o `code` quando o content type é `application/problem+json`.
 */
export function problema(status: number, code: string, title: string) {
  return {
    body: { type: 'about:blank', title, status, code, traceId: 'trace-1' },
    opts: {
      status,
      statusText: title,
      headers: { 'Content-Type': 'application/problem+json' },
    },
  };
}

export function iniciacao(expiraEmMs = Date.now() + 900_000) {
  return {
    documentoAPublicarId: DOCUMENTO_ID,
    urlUpload: URL_ASSINADA,
    contentTypeExigido: 'application/pdf',
    expiraEm: new Date(expiraEmMs).toISOString(),
  };
}

export function documentoConfirmado(id: string, hash: string, confirmadoEm: string) {
  return {
    id,
    processoSeletivoId: PROCESSO_ID,
    finalidade: FinalidadeDoDocumento.documentoDoEdital,
    nomeArquivo: 'edital.pdf',
    tipoDeMidia: 'application/pdf',
    status: 'Confirmado',
    criadoEm: '2026-08-20T12:00:00Z',
    expiraEm: '2026-08-20T12:15:00Z',
    tamanhoBytes: 2048,
    hashSha256: hash,
    confirmadoEm,
  };
}

/** Percorre as três fases até o documento selado. */
export async function percorrerOEnvio(
  etapas: EtapasDoEnvioDoEdital,
  controller: HttpTestingController,
  arquivo = pdf(),
): Promise<void> {
  void etapas.anexar(arquivo);
  await tick();

  const inicio = controller.expectOne(ROTA_DOCUMENTOS);
  expect(inicio.request.body).toEqual({
    finalidade: 'documentoDoEdital',
    nomeArquivo: arquivo.name,
    tipoDeMidia: 'application/pdf',
  });
  inicio.flush(iniciacao(), {
    status: 201,
    statusText: 'Created',
  });
  await tick();

  controller.expectOne(URL_ASSINADA).flush(null);
  await tick();

  controller
    .expectOne(`${ROTA_DOCUMENTOS}/${DOCUMENTO_ID}/confirmacao`)
    .flush({ id: DOCUMENTO_ID }, { status: 200, statusText: 'OK' });
  await tick();
}
