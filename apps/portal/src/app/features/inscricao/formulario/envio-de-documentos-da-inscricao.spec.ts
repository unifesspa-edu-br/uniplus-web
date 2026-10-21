import { HttpEventType } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignedUploadClient, errorResult, mockProblemDetails, okResult } from '@uniplus/shared-core/http';
import { InscricoesApi } from '@uniplus/shared-data/selecao';
import type { AlvoDoEnvio } from '@uniplus/shared-ui/components';

import { EnvioDeDocumentosDaInscricao } from './envio-de-documentos-da-inscricao';

const PROCESSO = 'processo-1';
const ALVO: AlvoDoEnvio = { chave: 'e1:', exigenciaId: 'e1', ocorrenciaId: null, nome: 'Laudo' };
const DESTINO = {
  arquivoId: 'arquivo-1',
  apresentacaoId: 'apresentacao-1',
  urlUpload: 'http://storage/laudo',
  contentTypeExigido: 'application/pdf',
  expiraEm: '2999-01-01T00:00:00Z',
};
const CONFIRMADO = {
  arquivoId: 'arquivo-1',
  apresentacaoId: 'apresentacao-1',
  exigenciaId: 'e1',
  ocorrenciaId: null,
  tipoDeMidia: 'application/pdf',
  tamanhoBytes: 7,
  hashSha256: 'abc',
  confirmadoEm: '2026-10-20T10:00:00Z',
};

describe('Envio dos documentos da inscrição', () => {
  const api = {
    iniciarEnvioDeDocumento: vi.fn(),
    confirmarEnvioDeDocumento: vi.fn(),
    removerArquivoDeDocumento: vi.fn(),
  };
  const upload = { enviar: vi.fn() };
  const andamento = vi.fn();
  const laudo = new File(['%PDF-1.7'], 'laudo.pdf', { type: 'application/pdf' });

  const envio = () =>
    TestBed.inject(EnvioDeDocumentosDaInscricao).paraOProcesso(PROCESSO);

  beforeEach(() => {
    vi.resetAllMocks();
    api.iniciarEnvioDeDocumento.mockReturnValue(of(okResult(DESTINO)));
    api.confirmarEnvioDeDocumento.mockReturnValue(of(okResult(CONFIRMADO)));
    upload.enviar.mockReturnValue(of({ type: HttpEventType.Response }));
    TestBed.configureTestingModule({
      providers: [
        EnvioDeDocumentosDaInscricao,
        { provide: InscricoesApi, useValue: api },
        { provide: SignedUploadClient, useValue: upload },
      ],
    });
  });

  it('inicia, envia os bytes à URL assinada e confirma, nesta ordem', async () => {
    const desfecho = await envio().enviar(ALVO, laudo, andamento);

    expect(api.iniciarEnvioDeDocumento).toHaveBeenCalledWith(
      PROCESSO,
      expect.objectContaining({
        exigenciaId: 'e1',
        tipoDeMidia: 'application/pdf',
        tamanhoBytes: laudo.size,
      }),
      expect.anything(),
    );
    expect(upload.enviar).toHaveBeenCalledWith(DESTINO.urlUpload, laudo, 'application/pdf');
    expect(api.confirmarEnvioDeDocumento).toHaveBeenCalledWith('processo-1', 'arquivo-1', expect.anything());
    expect(desfecho).toMatchObject({ ok: true, arquivo: { arquivoId: 'arquivo-1', chave: 'e1:' } });
    expect(andamento.mock.calls.map(([fase]) => fase)).toEqual(['iniciando', 'enviando', 'enviando', 'confirmando']);
  });

  it('confirmação que falha por erro do servidor: a nova tentativa só confirma, sem repetir o envio', async () => {
    api.confirmarEnvioDeDocumento.mockReturnValueOnce(
      of(errorResult(mockProblemDetails({ status: 503, title: 'Antivírus indisponível' }))),
    );
    const envioDoProcesso = envio();

    const primeira = await envioDoProcesso.enviar(ALVO, laudo, andamento);
    const segunda = await envioDoProcesso.enviar(ALVO, laudo, andamento);

    expect(primeira).toMatchObject({ ok: false, podeTentarDeNovo: true });
    expect(segunda.ok).toBe(true);
    expect(api.iniciarEnvioDeDocumento).toHaveBeenCalledTimes(1);
    expect(upload.enviar).toHaveBeenCalledTimes(1);
    expect(api.confirmarEnvioDeDocumento).toHaveBeenCalledTimes(2);
  });

  it('arquivo recusado pela exigência não oferece nova tentativa', async () => {
    api.iniciarEnvioDeDocumento.mockReturnValue(
      of(errorResult(mockProblemDetails({ status: 422, title: 'Formato não aceito' }))),
    );

    const desfecho = await envio().enviar(ALVO, laudo, andamento);

    expect(desfecho).toMatchObject({ ok: false, podeTentarDeNovo: false });
    expect(upload.enviar).not.toHaveBeenCalled();
  });

  it('URL vencida no armazenamento: a nova tentativa pede outra URL', async () => {
    upload.enviar.mockReturnValueOnce(throwError(() => ({ status: 403 })));
    const envioDoProcesso = envio();

    const primeira = await envioDoProcesso.enviar(ALVO, laudo, andamento);
    await envioDoProcesso.enviar(ALVO, laudo, andamento);

    expect(primeira.ok).toBe(false);
    expect(api.iniciarEnvioDeDocumento).toHaveBeenCalledTimes(2);
  });
});
