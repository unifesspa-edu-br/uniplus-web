import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { CONFIGURACAO_BASE_PATH, TipoBancaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TIPOS_BANCA_ROUTES } from './tipos-banca.routes';
import { TiposBancaPage } from './tipos-banca.page';
import { TiposBancaStore } from './tipos-banca.store';
import {
  TEXTO_TENTANDO,
  situacaoDoBotao,
} from '../../shared/foco/situacao-da-nova-tentativa.testing';

const BASE = 'http://localhost:5000';
const LISTA = `${BASE}/api/configuracao/tipos-banca`;
const TITULO_DA_LISTA = '#cfg-tipos-banca-list-title';
const banca = (codigo: string): TipoBancaDto => ({
  id: codigo,
  codigo,
  nome: codigo,
  faseTipica: null,
  descricao: null,
  criadoEm: '2026-06-10T12:00:00Z',
});
const indisponivel = [
  JSON.stringify({
    type: 'about:blank',
    title: 'Falha',
    status: 503,
    code: 'uniplus.internal.unexpected',
  }),
  {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'content-type': 'application/problem+json' },
  },
] as const;

describe('TiposBancaPage — listagem', () => {
  let fixture: ComponentFixture<TiposBancaPage>;
  let store: TiposBancaStore;
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
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });
  afterEach(() => controller.verify());

  async function propagar(): Promise<void> {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  }
  const requisicao = () => controller.expectOne((r) => r.url === LISTA);

  it('navega pelo cursor, volta pela página anterior e reinicia na primeira ao recarregar', async () => {
    requisicao().flush([banca('A')], {
      headers: { Link: '</api/configuracao/tipos-banca?cursor=abc&direction=next>; rel="next"' },
    });
    await propagar();
    store.proximaPagina();
    await propagar();
    const segunda = requisicao();
    expect(segunda.request.params.get('cursor')).toBe('abc');
    expect(segunda.request.params.get('direction')).toBe('next');
    segunda.flush([banca('B')], {
      headers: { Link: '</api/configuracao/tipos-banca?cursor=zzz&direction=prev>; rel="prev"' },
    });
    await propagar();
    expect(store.bancas()).toEqual([banca('B')]);
    store.paginaAnterior();
    await propagar();
    const voltando = requisicao();
    expect(voltando.request.params.get('direction')).toBe('prev');
    voltando.flush([banca('A')]);
    await propagar();
    store.recarregar();
    await propagar();
    const recarga = requisicao();
    expect(recarga.request.params.get('limit')).toBe('50');
    expect(recarga.request.params.has('cursor')).toBe(false);
    recarga.flush([banca('A')]);
  });

  it('notifica a falha do servidor na listagem e mostra a mensagem no alerta', async () => {
    const notificar = vi.spyOn(TestBed.inject(NotificationService), 'errorFromProblem');
    requisicao().flush(...indisponivel);
    await propagar();
    expect(notificar).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('ui-alerta-nova-tentativa')?.textContent).toContain(
      store.mensagemDeErro(),
    );
  });

  it('"Tentar novamente" recarrega e, ao dar certo, leva o foco ao título da lista', async () => {
    requisicao().flush(...indisponivel);
    await propagar();
    const tentar = [...fixture.nativeElement.querySelectorAll('button')].find(
      (botao: HTMLButtonElement) => botao.textContent?.trim() === 'Tentar novamente',
    ) as HTMLButtonElement;
    tentar.focus();
    tentar.click();
    await propagar();
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(situacaoDoBotao(tentar)).toBe(TEXTO_TENTANDO);
    expect(tentar.getAttribute('aria-busy')).toBe('true');
    expect(document.activeElement).toBe(tentar);
    tentar.click();
    requisicao().flush([banca('A')]);
    await propagar();
    await propagar();
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector(TITULO_DA_LISTA));
  });
});

describe('TIPOS_BANCA_ROUTES', () => {
  it('a rota raiz carrega a página de tipos de banca', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'tipos-banca', children: TIPOS_BANCA_ROUTES }]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/tipos-banca', TiposBancaPage);
    TestBed.inject(HttpTestingController).match(() => true);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Tipo de Banca');
  });
});
