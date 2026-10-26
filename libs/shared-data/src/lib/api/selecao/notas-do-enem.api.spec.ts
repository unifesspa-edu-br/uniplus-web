import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  apiResultInterceptor,
  buildVendorMimeAccept,
  isApiFailure,
  isApiOk,
} from '@uniplus/shared-core/http';

import { NotasDoEnemApi } from './notas-do-enem.api';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const ESCOPO = `${BASE}/api/selecao/processos-seletivos/p-1/etapas/e-1/edicoes-do-enem/2025`;
const LEIAUTE = { leiauteCodigo: 'RETORNO_INEP', leiauteVersao: '1' };

describe('NotasDoEnemApi', () => {
  let api: NotasDoEnemApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(NotasDoEnemApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('pede o catálogo pelo tipo, com o vendor MIME do leiaute', async () => {
    const promessa = firstValueFrom(api.listarLeiautes('retorno'));

    const req = controller.expectOne(
      (r) => r.url === `${BASE}/api/selecao/leiautes-de-arquivo-do-inep`,
    );
    expect(req.request.params.get('tipo')).toBe('retorno');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('leiaute-de-arquivo-do-inep', 1),
    );
    req.flush([]);

    expect(isApiOk(await promessa)).toBe(true);
  });

  describe('gerarEnvio', () => {
    it('entrega o texto do arquivo como ApiOk apesar do envelope do interceptor', async () => {
      const promessa = firstValueFrom(api.gerarEnvio('p-1', 'e-1', '2025', LEIAUTE));

      const req = controller.expectOne(`${ESCOPO}/envios-ao-inep`);
      expect(req.request.method).toBe('POST');
      expect(req.request.responseType).toBe('text');
      expect(req.request.body).toEqual(LEIAUTE);
      expect(req.request.headers.has('Idempotency-Key')).toBe(false);
      req.flush('11111111111\n22222222222\n', {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });

      const resultado = await promessa;
      expect(isApiOk(resultado) && resultado.data).toBe('11111111111\n22222222222\n');
    });

    it('preserva o código da recusa problem+json', async () => {
      const promessa = firstValueFrom(api.gerarEnvio('p-1', 'e-1', '2025', LEIAUTE));

      controller.expectOne(`${ESCOPO}/envios-ao-inep`).flush(
        JSON.stringify({
          type: 'https://uniplus.unifesspa.edu.br/erros/edicao_sem_inscritos',
          title: 'Edição sem inscritos',
          status: 422,
          code: 'uniplus.selecao.notas_do_enem.edicao_sem_inscritos',
          traceId: 't-1',
        }),
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'Content-Type': 'application/problem+json' },
        },
      );

      const resultado = await promessa;
      expect(isApiFailure(resultado) && resultado.problem.code).toBe(
        'uniplus.selecao.notas_do_enem.edicao_sem_inscritos',
      );
    });
  });

  describe('importarNotas', () => {
    it('envia o formulário multipart com os três campos e devolve o status', async () => {
      const arquivo = new File(['x'], 'retorno.txt', { type: 'text/plain' });
      const promessa = firstValueFrom(api.importarNotas('p-1', 'e-1', '2025', arquivo, LEIAUTE));

      const req = controller.expectOne(`${ESCOPO}/lotes-de-notas`);
      const corpo = req.request.body as FormData;
      expect(corpo).toBeInstanceOf(FormData);
      expect((corpo.get('arquivo') as File).name).toBe('retorno.txt');
      expect(corpo.get('leiauteCodigo')).toBe('RETORNO_INEP');
      expect(corpo.get('leiauteVersao')).toBe('1');
      expect(req.request.headers.has('Content-Type')).toBe(false);
      expect(req.request.headers.get('Accept')).toBe(
        buildVendorMimeAccept('lote-de-notas-do-enem', 1),
      );
      req.flush({ id: 'l-1' }, { status: 200, statusText: 'OK' });

      const resultado = await promessa;
      expect(isApiOk(resultado) && resultado.status).toBe(200);
    });
  });

  it('codifica o escopo na rota do lote', async () => {
    const promessa = firstValueFrom(api.obterLote('p-1', 'e-1', '2025', 'l 1'));

    controller.expectOne(`${ESCOPO}/lotes-de-notas/l%201`).flush({});
    await promessa;
  });
});
