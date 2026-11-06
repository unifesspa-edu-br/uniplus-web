import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TiposBancaPage } from './tipos-banca.page';
import { TiposBancaStore } from './tipos-banca.store';
import { EdicaoDosTiposBanca } from './edicao-dos-tipos-banca';
import { NotificationService } from '@uniplus/shared-core/notifications';

const BASE = 'http://localhost:5000';
const CRIAR_URL = `${BASE}/api/configuracao/admin/tipos-banca`;

const bancaSeed: TipoBancaDto = {
  id: '01960000-0000-7000-0000-0000000000b2',
  codigo: 'BANCA_ENTREVISTA',
  nome: 'Banca de Entrevista',
  faseTipica: 'Avaliação',
  descricao: null,
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('TiposBancaPage — remoção', () => {
  let fixture: ComponentFixture<TiposBancaPage>;
  let store: TiposBancaStore;
  let edicao: EdicaoDosTiposBanca;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TiposBancaPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TiposBancaPage);
    store = fixture.debugElement.injector.get(TiposBancaStore);
    edicao = fixture.debugElement.injector.get(EdicaoDosTiposBanca);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => {
    // A tela nunca deve emitir a criação de tipo de banca.
    controller.expectNone((r) => r.method === 'POST' && r.url === CRIAR_URL);
    controller.verify();
  });

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(itens: readonly TipoBancaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-banca`);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(itens);
    await propagate();
  }

  it('CA-06: cancelar a remoção fecha a confirmação e não envia a requisição', async () => {
    await flushLista([bancaSeed]);
    edicao.pedirRemocao(bancaSeed);
    fixture.detectChanges();

    expect(edicao.confirmando()).toBe(true);

    const dialogo = fixture.nativeElement.querySelector('cfg-tipo-banca-remocao') as HTMLElement;
    const cancelar = [...dialogo.querySelectorAll('button')].find(
      (botao) => botao.textContent?.trim() === 'Cancelar',
    ) as HTMLButtonElement;

    expect(cancelar.textContent?.trim()).toBe('Cancelar');

    cancelar.click();
    fixture.detectChanges();

    expect(edicao.confirmando()).toBe(false);
    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);
  });

  it('CA-08: confirma a remoção e atualiza a listagem', async () => {
    await flushLista([bancaSeed]);

    edicao.pedirRemocao(bancaSeed);
    edicao.removerConfirmado();

    const req = controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);

    expect(req.request.method).toBe('DELETE');

    req.flush(null, {
      status: 204,
      statusText: 'No Content',
    });

    await propagate();
    await flushLista([]);

    expect(store.bancas()).toEqual([]);
  });

  it('CA-09: falha na remoção avisa o usuário e mantém a lista', async () => {
    const erroSpy = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');

    await flushLista([bancaSeed]);

    edicao.pedirRemocao(bancaSeed);
    edicao.removerConfirmado();

    controller.expectOne(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`).flush(
      {
        type: 'about:blank',
        title: 'Tipo de banca não encontrado',
        status: 404,
        code: 'uniplus.configuracao.tipo_banca.nao_encontrado',
      },
      {
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'application/problem+json' },
      },
    );

    await propagate();

    expect(erroSpy).toHaveBeenCalled();
    expect(store.bancas()).toEqual([bancaSeed]);

    controller.expectNone((r) => r.url === `${BASE}/api/configuracao/tipos-banca`);
  });

  it('CA-10: a remoção pendente não é reenviada', async () => {
    await flushLista([bancaSeed]);

    edicao.pedirRemocao(bancaSeed);
    edicao.removerConfirmado();

    const primeira = controller.expectOne(
      `${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`,
    );

    edicao.removerConfirmado();

    controller.expectNone(`${BASE}/api/configuracao/admin/tipos-banca/${bancaSeed.id}`);

    primeira.flush(null, {
      status: 204,
      statusText: 'No Content',
    });

    await propagate();
    await flushLista([]);
  });
});
