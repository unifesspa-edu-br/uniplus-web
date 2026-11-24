import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ESCRITA,
  LISTA,
  LOCAL_DE_TESTE,
  PaginaDeLocais,
  carregarLista,
  indisponivel,
  montarPaginaComListaCarregada,
  montarPaginaDeLocais,
  raizDa,
  responderLista,
} from './locais-oferta.pagina.testing';

describe('Remoção de locais de oferta', () => {
  let pagina: PaginaDeLocais;
  const remocao = `${ESCRITA}/${LOCAL_DE_TESTE.id}`;

  beforeEach(async () => {
    pagina = await montarPaginaComListaCarregada();
  });
  afterEach(() => pagina.controller.verify());

  async function pedirRemocao(): Promise<void> {
    pagina.elemento<HTMLButtonElement>('button[aria-label^="Remover local de oferta"]').click();
    await pagina.propagar();
    pagina.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]').click();
    await pagina.propagar();
  }
  const dialogoDaRemocao = (): HTMLDialogElement =>
    pagina.elemento<HTMLDialogElement>('cfg-confirmacao-de-remocao dialog');
  const confirmarRemocao = (): HTMLButtonElement =>
    pagina.elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]');

  it('remoção pendente mantém o diálogo aberto, anuncia o andamento e recusa novo envio e o fechamento', async () => {
    const { controller, edicao, elemento, propagar } = pagina;
    elemento<HTMLButtonElement>('button[aria-label^="Remover local de oferta"]').click();
    await propagar();
    confirmarRemocao().focus();
    confirmarRemocao().click();
    await propagar();
    expect(edicao.saving()).toBe(false);
    expect(elemento('cfg-confirmacao-de-remocao [role="status"]').textContent?.trim()).toBe(
      'Removendo o local de oferta.',
    );
    expect(confirmarRemocao().getAttribute('aria-disabled')).toBe('true');
    expect(confirmarRemocao().getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(confirmarRemocao());
    expect(
      dialogoDaRemocao().querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.disabled,
    ).toBe(true);
    expect(indisponivel(pagina, '[data-testid="confirm-dialog-cancel"]')).toBe(true);
    dialogoDaRemocao().dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(dialogoDaRemocao().hasAttribute('open')).toBe(true);
    expect(edicao.confirmOpen()).toBe(true);
    confirmarRemocao().click();
    edicao.salvar();
    expect(indisponivel(pagina, '.panel-head .btn--primary')).toBe(true);
    expect(indisponivel(pagina, 'button[aria-label^="Editar local de oferta"]')).toBe(true);
    expect(indisponivel(pagina, 'button[aria-label^="Remover local de oferta"]')).toBe(true);
    controller.expectNone(ESCRITA);
    controller.expectOne(remocao).flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    expect(elemento(':scope > [role="status"]').textContent?.trim()).toBe(
      'Local de oferta removido.',
    );
    expect(edicao.gravando()).toBe(true);
    await carregarLista(pagina, [LOCAL_DE_TESTE]);
    expect(edicao.gravando()).toBe(false);
  });

  it('a confirmação repetida durante a remoção não envia uma segunda exclusão', async () => {
    const { controller, edicao } = pagina;
    edicao.pedirRemocao(LOCAL_DE_TESTE);
    edicao.removerConfirmado();
    edicao.removerConfirmado();
    controller.expectOne(remocao).flush(null, { status: 204, statusText: 'No Content' });
    await pagina.propagar();
    await carregarLista(pagina, [LOCAL_DE_TESTE]);
  });

  describe('remoção recusada', () => {
    async function recusarRemocao(status: number, code: string, title: string): Promise<void> {
      await pedirRemocao();
      pagina.controller
        .expectOne(remocao)
        .flush(JSON.stringify({ type: 'about:blank', title, status, code }), {
          status,
          statusText: 'Erro',
          headers: { 'content-type': 'application/problem+json' },
        });
      await pagina.propagar();
    }

    async function conferirDialogoComARecusa(titulo: string): Promise<void> {
      const { controller, edicao, elemento } = pagina;
      expect(dialogoDaRemocao().hasAttribute('open')).toBe(true);
      expect(elemento('cfg-confirmacao-de-remocao .field__error').textContent?.trim()).toBe(titulo);
      expect(elemento('cfg-confirmacao-de-remocao [role="status"]').textContent).toContain(
        `Não foi possível remover o local de oferta. ${titulo}`,
      );
      expect(confirmarRemocao().getAttribute('aria-disabled')).toBeNull();
      expect(edicao.gravando()).toBe(false);
      confirmarRemocao().click();
      controller.expectOne(remocao).flush(null, { status: 204, statusText: 'No Content' });
      await pagina.propagar();
      await carregarLista(pagina, [LOCAL_DE_TESTE]);
    }

    it('com 409, mantém o diálogo aberto com o motivo e o botão pronto para nova tentativa', async () => {
      const notificar = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
      const titulo = 'Local referenciado por oferta de curso ativa';
      await recusarRemocao(
        409,
        'uniplus.configuracao.local_oferta.remocao_bloqueada_por_oferta_curso',
        titulo,
      );
      expect(notificar).not.toHaveBeenCalled();
      await conferirDialogoComARecusa(titulo);
    });

    it('com 500, mantém o diálogo aberto com o motivo, notifica o servidor e permite nova tentativa', async () => {
      const notificar = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
      await recusarRemocao(500, 'uniplus.internal.unexpected', 'Erro interno');
      expect(notificar).toHaveBeenCalledWith(
        expect.objectContaining({ status: 500, code: 'uniplus.internal.unexpected' }),
        expect.objectContaining({ title: 'Erro interno' }),
      );
      await conferirDialogoComARecusa('Erro interno');
    });

    it('a recusa não aparece ao abrir a confirmação de novo', async () => {
      const { edicao, propagar } = pagina;
      await recusarRemocao(409, 'uniplus.configuracao.conflito', 'Em uso');
      edicao.confirmOpen.set(false);
      edicao.pedirRemocao(LOCAL_DE_TESTE);
      await propagar();
      expect(raizDa(pagina).querySelector('cfg-confirmacao-de-remocao .field__error')).toBeNull();
    });
  });

  it('"Tentar novamente" fica indisponível com a remoção pendente e a listagem falha', async () => {
    TestBed.resetTestingModule();
    pagina = montarPaginaDeLocais();
    const { controller, edicao, elemento, fixture, propagar } = pagina;
    fixture.detectChanges();
    controller
      .expectOne((r) => r.url === LISTA)
      .flush(JSON.stringify({ type: 'about:blank', title: 'Falha', status: 400, code: 'x' }), {
        status: 400,
        statusText: 'Bad',
        headers: { 'content-type': 'application/problem+json' },
      });
    await propagar();
    const tentar = elemento<HTMLButtonElement>('ui-falha-de-leitura button');
    expect(tentar.getAttribute('aria-disabled')).toBeNull();
    edicao.pedirRemocao(LOCAL_DE_TESTE);
    edicao.removerConfirmado();
    await propagar();
    expect(edicao.removendo()).toBe(true);
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    tentar.click();
    controller.expectNone((r) => r.url === LISTA);
    controller.expectOne(remocao).flush(null, { status: 204, statusText: 'No' });
    await propagar();
    responderLista(pagina, [LOCAL_DE_TESTE]);
    await propagar();
  });
});
