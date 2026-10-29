import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SignedUploadClient } from '@uniplus/shared-core/http';
import { PedidosDeConcessaoApi } from '@uniplus/shared-data/autorizacao';
import { AnexoDoPedidoService } from './anexo-do-pedido.service';
import { ok, recusa } from './testes';

const PARA_ENVIO = {
  id: 'anexo-1',
  situacao: 'aguardando_envio',
  urlDeEnvio: 'https://armazenamento.exemplo.test/put',
  tipoDeMidia: 'application/pdf',
  expiraEm: '2999-01-01T00:00:00Z',
};

describe('AnexoDoPedidoService', () => {
  const api = {
    iniciarAnexo: vi.fn(),
    confirmarAnexo: vi.fn(),
    acessoAoAnexo: vi.fn(),
  };
  const armazenamento = { enviar: vi.fn() };
  const arquivo = new File(['%PDF'], 'designacao.pdf', { type: 'application/pdf' });

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: PedidosDeConcessaoApi, useValue: api },
        { provide: SignedUploadClient, useValue: armazenamento },
      ],
    });
  });

  it('registra, envia ao armazenamento e confirma com o ETag', async () => {
    api.iniciarAnexo.mockReturnValue(of(ok(PARA_ENVIO)));
    armazenamento.enviar.mockReturnValue(
      of(new HttpResponse({ status: 200, headers: new HttpHeaders({ ETag: '"abc"' }) })),
    );
    api.confirmarAnexo.mockReturnValue(of(ok({ id: 'anexo-1' })));
    const fases: string[] = [];

    const desfecho = await TestBed.inject(AnexoDoPedidoService).anexar('p1', arquivo, (fase) =>
      fases.push(fase),
    );

    expect(desfecho).toEqual({ ok: true });
    expect(api.confirmarAnexo.mock.calls[0]?.slice(0, 3)).toEqual(['p1', 'anexo-1', '"abc"']);
    expect(fases).toEqual(expect.arrayContaining(['registrando', 'confirmando']));
  });

  it('devolve a mensagem da API quando o registro é recusado', async () => {
    api.iniciarAnexo.mockReturnValue(of(recusa('uniplus.autorizacao.pedido.anexo_invalido')));

    const desfecho = await TestBed.inject(AnexoDoPedidoService).anexar(
      'p1',
      arquivo,
      () => undefined,
    );

    expect(desfecho).toEqual({ ok: false, mensagem: 'Recusado' });
    expect(armazenamento.enviar).not.toHaveBeenCalled();
  });

  it('explica a falha do armazenamento e a URL vencida', async () => {
    api.iniciarAnexo.mockReturnValue(of(ok(PARA_ENVIO)));
    const servico = TestBed.inject(AnexoDoPedidoService);

    armazenamento.enviar.mockReturnValue(throwError(() => ({ status: 0 })));
    expect(await servico.anexar('p1', arquivo, () => undefined)).toEqual({
      ok: false,
      mensagem: 'Falha ao enviar o arquivo. Verifique a conexão e tente novamente.',
    });

    armazenamento.enviar.mockReturnValue(throwError(() => ({ status: 403 })));
    expect(await servico.anexar('p1', arquivo, () => undefined)).toEqual({
      ok: false,
      mensagem: 'O endereço de envio venceu. Tente novamente para obter um novo.',
    });
  });

  it('devolve a recusa da confirmação', async () => {
    api.iniciarAnexo.mockReturnValue(of(ok(PARA_ENVIO)));
    armazenamento.enviar.mockReturnValue(of(new HttpResponse({ status: 200 })));
    api.confirmarAnexo.mockReturnValue(of(recusa('uniplus.x', 409, 'Conflito')));

    const desfecho = await TestBed.inject(AnexoDoPedidoService).anexar(
      'p1',
      arquivo,
      () => undefined,
    );

    expect(desfecho).toEqual({ ok: false, mensagem: 'Conflito' });
  });

  it('abre o anexo verificado em aba nova, sem guardar a URL', async () => {
    const aba = { opener: {}, location: { href: '' }, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(aba as unknown as Window);
    api.acessoAoAnexo.mockReturnValue(of(ok({ url: 'https://armazenamento.exemplo.test/get' })));

    const desfecho = await TestBed.inject(AnexoDoPedidoService).abrir('p1', 'a1', () => true);

    expect(desfecho).toBe('aberta');
    expect(aba.location.href).toBe('https://armazenamento.exemplo.test/get');
  });

  it('informa o bloqueio de janelas e a recusa da API ao abrir', async () => {
    const servico = TestBed.inject(AnexoDoPedidoService);
    const abrir = vi.spyOn(window, 'open');

    abrir.mockReturnValue(null);
    expect(await servico.abrir('p1', 'a1', () => true)).toBe('bloqueada');

    const aba = { opener: {}, location: { href: '' }, close: vi.fn() };
    abrir.mockReturnValue(aba as unknown as Window);
    api.acessoAoAnexo.mockReturnValue(
      of(recusa('uniplus.autorizacao.pedido.anexo_nao_verificado')),
    );
    expect(await servico.abrir('p1', 'a1', () => true)).toEqual({ recusa: 'Recusado' });
  });
});
