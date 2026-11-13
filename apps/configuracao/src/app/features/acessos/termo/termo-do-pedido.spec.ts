import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApiResult } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  TermosDeResponsabilidadeApi,
  type VersaoDoTermoDto,
} from '@uniplus/shared-data/autorizacao';
import { provideMensagensDeAcesso } from '../mensagens-de-acesso';
import { ok, recusa, versaoDoTermo } from '../testes';
import { TermoDoPedido } from './termo-do-pedido';

const V1 = versaoDoTermo({ id: 'termo-v1', numero: 1, texto: 'Texto da versão um do termo.' });
const V2 = versaoDoTermo();

describe('TermoDoPedido', () => {
  const api = { versao: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TermoDoPedido,
        provideMensagensDeAcesso(),
        { provide: TermosDeResponsabilidadeApi, useValue: api },
        { provide: NotificationService, useValue: { errorFromProblem: vi.fn() } },
      ],
    });
  });

  const lerAte = async (termo: TermoDoPedido) => {
    await vi.waitFor(() => expect(termo.carregando()).toBe(false));
  };

  it('descarta a resposta da versão de um pedido anterior que chega depois da troca', async () => {
    const antiga = new Subject<ApiResult<VersaoDoTermoDto>>();
    api.versao.mockImplementation((id: string) => (id === 'termo-v1' ? antiga : of(ok(V2))));
    const termo = TestBed.inject(TermoDoPedido);

    termo.acompanhar('termo-v1');
    termo.acompanhar('termo-v2');
    await lerAte(termo);
    antiga.next(ok(V1));
    antiga.complete();
    await Promise.resolve();

    expect(termo.versao()?.id).toBe('termo-v2');
  });

  it('só apresenta no aceite a versão fixada, lida e marcada', async () => {
    api.versao.mockReturnValue(of(ok(V2)));
    const termo = TestBed.inject(TermoDoPedido);
    termo.acompanhar('termo-v2');
    await lerAte(termo);

    expect(termo.versaoApresentada()).toBeNull();
    termo.aceite.setValue(true);
    expect(termo.versaoApresentada()).toBe('termo-v2');
    termo.acompanhar(null);
    expect(termo.versaoApresentada()).toBeNull();
  });

  it('repete a leitura que falhou', async () => {
    api.versao
      .mockReturnValueOnce(of(recusa('uniplus.internal.unexpected', 500, 'Erro interno')))
      .mockReturnValueOnce(of(ok(V2)));
    const termo = TestBed.inject(TermoDoPedido);
    termo.acompanhar('termo-v2');
    await lerAte(termo);
    expect(termo.erro()).not.toBeNull();

    termo.tentarNovamente();
    await lerAte(termo);

    expect(termo.erro()).toBeNull();
    expect(termo.versao()?.id).toBe('termo-v2');
  });
});
