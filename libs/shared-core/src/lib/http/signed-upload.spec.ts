import { HttpEventType, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { lastValueFrom, toArray } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from './api-result.interceptor';
import { SignedUploadClient } from './signed-upload';

const URL_ASSINADA =
  'http://localhost:9000/uniplus-selecao/editais/documento.pdf?X-Amz-Signature=abc';

describe('SignedUploadClient', () => {
  let client: SignedUploadClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // O interceptor é registrado de propósito: o cliente roda sobre
        // HttpBackend e não deve ser afetado por ele.
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(SignedUploadClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('faz PUT com o content type assinado e reporta progresso', async () => {
    const arquivo = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    const eventos = lastValueFrom(
      client.enviar(URL_ASSINADA, arquivo, 'application/pdf').pipe(toArray()),
    );

    const req = controller.expectOne(URL_ASSINADA);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('Content-Type')).toBe('application/pdf');
    expect(req.request.reportProgress).toBe(true);
    req.event({ type: HttpEventType.UploadProgress, loaded: 4, total: 8 });
    req.flush(null);

    const tipos = (await eventos).map((evento) => evento.type);
    expect(tipos).toContain(HttpEventType.UploadProgress);
    expect(tipos).toContain(HttpEventType.Response);
  });

  it('não anexa Authorization nem Accept versionado ao destino do storage', async () => {
    const arquivo = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    const promise = lastValueFrom(client.enviar(URL_ASSINADA, arquivo, 'application/pdf'));

    const req = controller.expectOne(URL_ASSINADA);
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.headers.get('Accept')).toBeNull();
    req.flush(null);

    await promise;
  });

  /**
   * O 403 do storage significa assinatura inválida — quase sempre URL expirada.
   * Envelopado pelo `apiResultInterceptor`, viraria resposta de sucesso e o
   * `authErrorInterceptor` mandaria o operador para `/acesso-negado`; o
   * chamador precisa vê-lo como erro para pedir uma URL nova.
   */
  it('propaga o 403 do storage como erro HTTP, sem envelope', async () => {
    const arquivo = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    const promise = lastValueFrom(client.enviar(URL_ASSINADA, arquivo, 'application/pdf'));

    controller.expectOne(URL_ASSINADA).flush('<Error><Code>AccessDenied</Code></Error>', {
      status: 403,
      statusText: 'Forbidden',
    });

    await expect(promise).rejects.toMatchObject({ status: 403 });
  });
});
