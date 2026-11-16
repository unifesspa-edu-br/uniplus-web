import { HttpTestingController } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOGO } from './catalogo-de-fatos.fixture';
import { EdicaoDasModalidades } from './edicao-das-modalidades';
import { ModalidadesListPage } from './modalidades-list.page';
import { URL, URL_ADMIN, URL_CATALOGO } from './modalidades-de-teste.testing';
import { configurar, modalidade } from './modalidades.escritas.testing';
import { ModalidadesStore } from './modalidades.store';

describe('Modalidades — remoção pela interface', () => {
  let fixture: ComponentFixture<ModalidadesListPage>;
  let controller: HttpTestingController;
  let edicao: EdicaoDasModalidades;
  let app: ApplicationRef;
  const propagar = async (): Promise<void> => {
    await Promise.resolve();
    app.tick();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    configurar();
    fixture = TestBed.createComponent(ModalidadesListPage);
    controller = TestBed.inject(HttpTestingController);
    app = TestBed.inject(ApplicationRef);
    edicao = fixture.debugElement.injector.get(EdicaoDasModalidades);
    fixture.detectChanges();
    controller.expectOne((r) => r.url === URL).flush([modalidade]);
    controller.match(URL_CATALOGO).forEach((r) => r.flush(CATALOGO));
    await propagar();
  });
  afterEach(() => controller.verify());

  it('impede tentar novamente enquanto uma remoção está pendente', async () => {
    edicao.remover(modalidade);
    const remocao = controller.expectOne(`${URL_ADMIN}/${modalidade.id}`);
    fixture.debugElement.injector.get(ModalidadesStore).recarregar();
    await propagar();
    controller
      .expectOne((r) => r.url === URL)
      .flush(
        { type: 'about:blank', title: 'Indisponível', status: 503, code: 'erro' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await propagar();
    const retry = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ].find((b) => b.textContent?.trim() === 'Tentar novamente');
    expect(retry?.getAttribute('aria-disabled')).toBe('true');
    expect(retry?.disabled).toBe(false);
    remocao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne((r) => r.url === URL).flush([]);
    await propagar();
  });

  it('"Tentar novamente" que dá certo leva o foco, que estava no botão, ao título da lista', async () => {
    const raiz = fixture.nativeElement as HTMLElement;
    fixture.debugElement.injector.get(ModalidadesStore).recarregar();
    await propagar();
    controller
      .expectOne((r) => r.url === URL)
      .flush(
        { type: 'about:blank', title: 'Indisponível', status: 503, code: 'erro' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    await propagar();
    const tentar = [...raiz.querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === 'Tentar novamente',
    ) as HTMLButtonElement;
    tentar.focus();
    tentar.click();
    await propagar();

    controller.expectOne((r) => r.url === URL).flush([modalidade]);
    await propagar();
    await propagar();
    expect(document.activeElement).toBe(raiz.querySelector('#cfg-modalidades-title'));
  });

  it('o diálogo de remoção põe os botões direto no rodapé, sem contêiner entre eles', async () => {
    const raiz = fixture.nativeElement as HTMLElement;
    raiz.querySelector<HTMLButtonElement>('button[aria-label="Remover modalidade V"]')?.click();
    await propagar();
    const botoes = [
      ...raiz.querySelectorAll<HTMLButtonElement>('dialog .uni-dialog__footer > button'),
    ];
    expect(botoes.map((b) => b.textContent?.trim())).toEqual(['Cancelar', 'Remover']);
  });

  it('anuncia a remoção e mantém a trava até terminar a recarga', async () => {
    const raiz = fixture.nativeElement as HTMLElement;
    raiz.querySelector<HTMLButtonElement>('button[aria-label="Remover modalidade V"]')?.click();
    await propagar();
    const confirmar = [...raiz.querySelectorAll<HTMLButtonElement>('dialog button')].find(
      (b) => b.textContent?.trim() === 'Remover',
    );
    confirmar?.click();
    const requisicao = controller.expectOne(`${URL_ADMIN}/${modalidade.id}`);
    await propagar();
    expect(edicao.removendo()).toBe(true);
    const dialogo = raiz.querySelector<HTMLDialogElement>('dialog');
    const fechar = dialogo?.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]');
    if (!dialogo || !fechar) throw new Error('Diálogo ou botão de fechar não encontrado.');
    expect(fechar.disabled).toBe(true);
    fechar.click();
    dialogo.dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(dialogo.open).toBe(true);
    expect(raiz.querySelector('dialog [role="status"]')?.textContent).toContain(
      'Removendo a modalidade V.',
    );
    expect(raiz.querySelector('[data-scope]')?.hasAttribute('inert')).toBe(true);
    expect(
      raiz.querySelector<HTMLButtonElement>('button[aria-label="Remover modalidade V"]')?.disabled,
    ).toBe(true);
    edicao.remover(modalidade);
    controller.expectNone(`${URL_ADMIN}/${modalidade.id}`);
    requisicao.flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    expect(edicao.removendo()).toBe(true);
    edicao.remover(modalidade);
    controller.expectNone(`${URL_ADMIN}/${modalidade.id}`);
    controller.expectOne((r) => r.url === URL).flush([]);
    await propagar();
    expect(edicao.removendo()).toBe(false);
    expect(raiz.querySelector('.sr-only[role="status"]')?.textContent).toContain(
      'Modalidade V removida.',
    );
  });

  describe.each([
    { status: 422, avisa: false },
    { status: 503, avisa: true },
  ])('falha $status na remoção', ({ status, avisa }) => {
    it(`${avisa ? 'avisa por toast' : 'não avisa por toast e mantém a mensagem no diálogo'}`, async () => {
      const toast = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
      edicao.remover(modalidade);
      controller
        .expectOne(`${URL_ADMIN}/${modalidade.id}`)
        .flush(
          { type: 'about:blank', title: 'Recusada', status, code: 'erro' },
          { status, statusText: 'Erro' },
        );
      await propagar();
      expect(toast).toHaveBeenCalledTimes(avisa ? 1 : 0);
      expect(edicao.mensagemBloqueioServidor()).not.toBeNull();
      expect(edicao.removendo()).toBe(false);
    });
  });
});
