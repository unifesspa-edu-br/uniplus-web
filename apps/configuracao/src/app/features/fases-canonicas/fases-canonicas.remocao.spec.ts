import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BASE,
  CenaDaPagina,
  URL_DA_LISTA,
  faseAvaliacaoSeed,
  faseRecursoSeed,
  montarPagina,
  propagar,
  responderLista,
  urlRemocao,
  verificarRequisicoesDaPagina,
} from './fases-canonicas.testing';

describe('FasesCanonicasPage — remoção', () => {
  let cena: CenaDaPagina;

  beforeEach(() => {
    cena = montarPagina();
  });

  afterEach(() => verificarRequisicoesDaPagina(cena));

  it('CA-08/CA-09/CA-10: remove uma fase canônica após confirmação e recarrega a lista', async () => {
    const sucessoSpy = vi.spyOn(TestBed.inject(NotificationService), 'success');
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.edicao.pedirRemocao(faseAvaliacaoSeed);
    cena.edicao.removerConfirmado();

    const req = cena.controller.expectOne(
      `${BASE}/api/configuracao/admin/fases-canonicas/${faseAvaliacaoSeed.id}`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagar(cena);
    await responderLista(cena, []);
    expect(sucessoSpy).toHaveBeenCalledWith('Fase canônica removida', 'AVALIACAO');
  });

  it('CA-01/CA-03/CA-04/CA-05/CA-06/CA-07: lixeira e confirmação falam em remover e identificam a fase', async () => {
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.fixture.detectChanges();
    const lixeira = cena.fixture.nativeElement.querySelector(
      'button[aria-label="Remover fase canônica AVALIACAO"]',
    ) as HTMLButtonElement;
    expect(lixeira.getAttribute('data-tooltip')).toBe('Remover fase canônica');
    expect(lixeira.querySelector('.pi-trash')).not.toBeNull();
    expect(cena.fixture.nativeElement.querySelector('button[aria-label^="Inativar"]')).toBeNull();

    lixeira.click();
    cena.fixture.detectChanges();
    const dialogo = cena.fixture.nativeElement.querySelector(
      'cfg-confirmacao-de-remocao',
    ) as HTMLElement;
    expect(dialogo.querySelector('h3')?.textContent?.trim()).toBe('Remover fase canônica');
    expect(dialogo.querySelector('.uni-dialog__body')?.textContent).toContain(
      'Deseja remover a fase AVALIACAO?',
    );
    expect(
      dialogo.querySelector('[data-testid="confirm-dialog-confirm"]')?.textContent?.trim(),
    ).toBe('Remover');
    expect(dialogo.textContent).not.toMatch(/inativ/iu);
  });

  it('CA-11: falha 4xx na remoção não notifica o servidor e mantém a lista', async () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.edicao.pedirRemocao(faseAvaliacaoSeed);
    cena.edicao.removerConfirmado();

    cena.controller.expectOne(urlRemocao(faseAvaliacaoSeed)).flush(
      {
        type: 'about:blank',
        title: 'Fase canônica não encontrada',
        status: 404,
        code: 'uniplus.configuracao.fase_canonica.nao_encontrada',
      },
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar(cena);

    expect(erroSpy).not.toHaveBeenCalled();
    expect(cena.edicao.removendo()).toBe(false);
    cena.controller.expectNone((r) => r.url === URL_DA_LISTA);
  });

  it('CA-11: falha 5xx na remoção notifica o servidor com o título resolvido', async () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    await responderLista(cena, [faseAvaliacaoSeed]);
    cena.edicao.pedirRemocao(faseAvaliacaoSeed);
    cena.edicao.removerConfirmado();

    cena.controller.expectOne(urlRemocao(faseAvaliacaoSeed)).flush(
      {
        type: 'about:blank',
        title: 'Erro interno',
        status: 500,
        code: 'uniplus.internal.unexpected',
      },
      {
        status: 500,
        statusText: 'Server Error',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar(cena);

    expect(erroSpy).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ status: 500 }), {
      title: expect.any(String),
    });
  });

  it('CA-12: impede remoções concorrentes e mantém a trava durante a recarga', async () => {
    await responderLista(cena, [faseAvaliacaoSeed, faseRecursoSeed]);
    cena.edicao.pedirRemocao(faseAvaliacaoSeed);
    cena.edicao.removerConfirmado();
    cena.edicao.confirmando.set(false);
    const primeira = cena.controller.expectOne(urlRemocao(faseAvaliacaoSeed));
    cena.edicao.pedirRemocao(faseAvaliacaoSeed);
    expect(cena.edicao.confirmando()).toBe(false);
    cena.edicao.pedirRemocao(faseRecursoSeed);
    cena.edicao.removerConfirmado();
    cena.controller.expectNone(urlRemocao(faseRecursoSeed));
    primeira.flush(null, { status: 204, statusText: 'No Content' });
    await propagar(cena);
    cena.edicao.pedirRemocao(faseRecursoSeed);
    expect(cena.edicao.confirmando()).toBe(false);
    await responderLista(cena, [faseRecursoSeed]);
    cena.edicao.pedirRemocao(faseRecursoSeed);
    cena.edicao.removerConfirmado();
    cena.controller
      .expectOne(urlRemocao(faseRecursoSeed))
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar(cena);
    await responderLista(cena, []);
    expect(cena.edicao.mensagemDaConfirmacao()).toBe('Deseja remover esta fase canônica?');
  });
});
