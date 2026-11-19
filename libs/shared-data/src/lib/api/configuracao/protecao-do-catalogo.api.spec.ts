import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';
import {
  ProtecaoDoCatalogoApi,
  type DecidirProtecaoDoCatalogoRequest,
} from './protecao-do-catalogo.api';
import { CONFIGURACAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/admin/protecao-do-catalogo`;
const ID = '01960000-0000-7000-0000-0000000000d2';

describe('ProtecaoDoCatalogoApi', () => {
  let api: ProtecaoDoCatalogoApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(ProtecaoDoCatalogoApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('listar() filtra pela situação e pede o tipo de mídia versionado', async () => {
    const promise = firstValueFrom(api.listar('SOLICITADA'));
    const req = controller.expectOne((r) => r.url === URL);
    expect(req.request.params.get('situacao')).toBe('SOLICITADA');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('protecao-do-catalogo', 1),
    );
    req.flush([]);
    await promise;
  });

  it('solicitar() envia só os itens escolhidos, com Idempotency-Key', async () => {
    const itens = [{ cadastro: 'FATO', id: ID }] as const;
    const promise = firstValueFrom(api.solicitar(itens, withIdempotencyKey('k')));
    const req = controller.expectOne(`${URL}/solicitacoes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ itens });
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush({ tiposDeDocumento: 0, fatos: 1 });
    await promise;
  });

  it('decidir() leva a proteção conferida, a recomendação e a justificativa, com Idempotency-Key', async () => {
    const command = {
      cadastro: 'TIPO_DOCUMENTO',
      itemId: ID,
      decisao: 'RECOMENDAR_AJUSTE',
      classificacaoProtecao: 'INTERNO',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      finalidadeTratamento: 'Conferir o laudo.',
      classificacaoRecomendada: 'SENSIVEL',
      justificativa: 'O laudo traz dado de saúde.',
      ciclo: 2,
      manifestacoesNoCiclo: 1,
    } as const satisfies DecidirProtecaoDoCatalogoRequest;
    const promise = firstValueFrom(api.decidir(command, withIdempotencyKey('k')));
    const req = controller.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(command);
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });

  it('manifestar() leva o ciclo lido, o parecer e o texto, com Idempotency-Key', async () => {
    const corpo = {
      cadastro: 'FATO',
      itemId: ID,
      ciclo: 2,
      parecer: 'INADEQUADA',
      texto: 'O laudo revela condição de saúde.',
    } as const;
    const promise = firstValueFrom(api.manifestar(corpo, withIdempotencyKey('k')));
    const req = controller.expectOne(`${URL}/manifestacoes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(corpo);
    expect(req.request.headers.get('Idempotency-Key')).toBe('k');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });

  it.each([
    ['TIPO_DOCUMENTO', 'tipos-documento'],
    ['FATO', 'fatos'],
  ] as const)(
    'manifestacoes() lê o histórico de %s pelo segmento do cadastro',
    async (cadastro, segmento) => {
      const promise = firstValueFrom(api.manifestacoes(cadastro, ID));
      const req = controller.expectOne(`${URL}/${segmento}/${ID}/manifestacoes`);
      expect(req.request.headers.get('Accept')).toBe(
        buildVendorMimeAccept('protecao-do-catalogo-manifestacao', 1),
      );
      req.flush([]);
      await promise;
    },
  );
});
