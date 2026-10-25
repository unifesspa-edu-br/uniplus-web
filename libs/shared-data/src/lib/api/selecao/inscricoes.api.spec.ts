import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor, buildVendorMimeAccept } from '@uniplus/shared-core/http';
import { withIdempotencyKey } from '@uniplus/shared-core/idempotency';

import { InscricoesApi } from './inscricoes.api';
import type { InscricaoRequest } from './inscricoes.contrato';
import { SELECAO_BASE_PATH } from './tokens';

const BASE = 'http://localhost:5000';
const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';
const INSCRICAO = '0199e000-0000-7000-8000-0000000000e1';
const ROTA = `${BASE}/api/selecao/processos-seletivos/${PROCESSO}/inscricao`;
const ETAG = '"inscricao-1:3"';
const REQUEST: InscricaoRequest = { ofertaCursoId: null, respostas: {}, grupos: null, aceites: [] };

describe('InscricoesApi', () => {
  let api: InscricoesApi;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    api = TestBed.inject(InscricoesApi);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('salva o rascunho com o ETag no If-Match', async () => {
    const promessa = firstValueFrom(api.salvar(PROCESSO, REQUEST, ETAG));

    const req = controller.expectOne(ROTA);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('If-Match')).toBe(ETAG);
    expect(req.request.headers.get('Accept')).toBe(buildVendorMimeAccept('inscricao', 1));
    req.flush({});
    await promessa;
  });

  it('consulta a avaliação por POST, sem If-Match nem Idempotency-Key, no media type dela', async () => {
    const promessa = firstValueFrom(api.avaliar(PROCESSO, { respostas: {}, grupos: null }));

    const req = controller.expectOne(`${ROTA}/avaliacoes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('If-Match')).toBe(false);
    expect(req.request.headers.has('Idempotency-Key')).toBe(false);
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('avaliacao-da-inscricao', 1),
    );
    req.flush({});
    await promessa;
  });

  it('envia com o If-Match, a Idempotency-Key de quem chama e o media type do comprovante', async () => {
    const promessa = firstValueFrom(
      api.submeter(PROCESSO, REQUEST, ETAG, withIdempotencyKey('envio-1')),
    );

    const req = controller.expectOne(`${ROTA}/submissao`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('If-Match')).toBe(ETAG);
    expect(req.request.headers.get('Idempotency-Key')).toBe('envio-1');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('comprovante-inscricao', 1),
    );
    req.flush({});
    await promessa;
  });
  it('descarta o rascunho por DELETE com o ETag no If-Match', async () => {
    const promessa = firstValueFrom(api.descartar(PROCESSO, ETAG));

    const req = controller.expectOne(ROTA);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.headers.get('If-Match')).toBe(ETAG);
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promessa;
  });

  it('cancela com o motivo, o If-Match e a Idempotency-Key de quem chama', async () => {
    const promessa = firstValueFrom(
      api.cancelar(PROCESSO, { motivo: 'Mudei de curso' }, ETAG, withIdempotencyKey('cancelar-1')),
    );

    const req = controller.expectOne(`${ROTA}/cancelamento`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ motivo: 'Mudei de curso' });
    expect(req.request.headers.get('If-Match')).toBe(ETAG);
    expect(req.request.headers.get('Idempotency-Key')).toBe('cancelar-1');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await promessa;
  });

  it('lê o comprovante pelo id da inscrição e as inscrições do dono, com o media type de cada um', async () => {
    const comprovante = firstValueFrom(api.obterComprovante(INSCRICAO, 2));
    const minhas = firstValueFrom(api.minhas());

    const reqComprovante = controller.expectOne(
      `${BASE}/api/selecao/inscricoes/${INSCRICAO}/comprovantes/2`,
    );
    expect(reqComprovante.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('comprovante-inscricao', 1),
    );
    const reqMinhas = controller.expectOne(`${BASE}/api/selecao/minhas-inscricoes`);
    expect(reqMinhas.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('minhas-inscricoes', 1),
    );
    reqComprovante.flush({});
    reqMinhas.flush([]);
    await Promise.all([comprovante, minhas]);
  });

  it('pede o acesso ao arquivo do candidato no media type próprio, sem corpo', async () => {
    const promessa = firstValueFrom(api.obterAcessoDoArquivo(PROCESSO, 'a 1'));

    const req = controller.expectOne(`${ROTA}/documentos/arquivos/a%201/acesso`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe(
      buildVendorMimeAccept('acesso-arquivo-do-candidato', 1),
    );
    req.flush({});
    await promessa;
  });

  it('envia o documento em três chamadas, cada uma com a Idempotency-Key de quem chama', async () => {
    const rota = `${ROTA}/documentos`;
    const iniciar = firstValueFrom(
      api.iniciarEnvioDeDocumento(
        PROCESSO,
        {
          exigenciaId: 'e1',
          ocorrenciaId: null,
          apresentacaoId: null,
          tipoDeMidia: 'application/pdf',
          tamanhoBytes: 10,
        },
        withIdempotencyKey('iniciar-1'),
      ),
    );
    const pedido = controller.expectOne(`${rota}/envios`);
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toMatchObject({ exigenciaId: 'e1', tamanhoBytes: 10 });
    expect(pedido.request.headers.get('Idempotency-Key')).toBe('iniciar-1');
    pedido.flush(null);
    await iniciar;

    const confirmar = firstValueFrom(
      api.confirmarEnvioDeDocumento(
        PROCESSO,
        'a 1',
        { etag: '"abc"' },
        withIdempotencyKey('confirmar-1'),
      ),
    );
    const confirmacao = controller.expectOne(`${rota}/envios/a%201/confirmacao`);
    expect(confirmacao.request.method).toBe('POST');
    expect(confirmacao.request.headers.get('Idempotency-Key')).toBe('confirmar-1');
    expect(confirmacao.request.body).toEqual({ etag: '"abc"' });
    confirmacao.flush(null);
    await confirmar;

    const remover = firstValueFrom(
      api.removerArquivoDeDocumento(PROCESSO, 'a1', withIdempotencyKey('remover-1')),
    );
    const remocao = controller.expectOne(`${rota}/arquivos/a1`);
    expect(remocao.request.method).toBe('DELETE');
    expect(remocao.request.headers.get('Idempotency-Key')).toBe('remover-1');
    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await remover;
  });
});
