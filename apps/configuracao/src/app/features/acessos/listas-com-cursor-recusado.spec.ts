import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { AUTORIZACAO_BASE_PATH, PerfisApi } from '@uniplus/shared-data/autorizacao';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';
import { ConcessoesPage } from './concessoes.page';
import { ConcessoesStore } from './concessoes.store';
import { PedidosPage } from './pedidos.page';
import { PedidosStore } from './pedidos.store';
import { PerfisPage } from './perfis.page';
import { PerfisStore } from './perfis.store';
import { ok, UNIDADES } from './testes';

const BASE = 'http://api.test/api/autorizacao';
const PROXIMA = { headers: { Link: '<x?cursor=proximo>; rel="next"' } };

interface LojaPaginada {
  proximaPagina(): void;
  carregando(): boolean;
  mensagemDeErro(): string | null;
}

interface Lista {
  readonly nome: string;
  readonly pagina: Type<unknown>;
  readonly loja: Type<LojaPaginada>;
  readonly url: string;
}

const LISTAS: readonly Lista[] = [
  { nome: 'pedidos', pagina: PedidosPage, loja: PedidosStore, url: `${BASE}/pedidos-de-concessao` },
  { nome: 'concessões', pagina: ConcessoesPage, loja: ConcessoesStore, url: `${BASE}/concessoes` },
  { nome: 'perfis', pagina: PerfisPage, loja: PerfisStore, url: `${BASE}/perfis` },
];

function problema(status: number, code: string) {
  return [
    { title: 'Erro', status, code, type: 'about:blank', traceId: '' },
    { status, statusText: 'Erro', headers: { 'Content-Type': 'application/problem+json' } },
  ] as const;
}

describe('listas de acessos paginadas por cursor', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AUTORIZACAO_BASE_PATH, useValue: 'http://api.test' },
        { provide: PerfisApi, useValue: {} },
        { provide: NotificationService, useValue: { info: vi.fn(), errorFromProblem: vi.fn() } },
        { provide: UnidadesApi, useValue: { listar: () => of(ok(UNIDADES)) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  async function atualizar(): Promise<void> {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
  }

  async function naSegundaPaginaEmFalha(lista: Lista): Promise<ComponentFixture<unknown>> {
    const fixture = TestBed.createComponent(lista.pagina);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.startsWith(lista.url) && !r.url.endsWith('/permissoes'))
      .flush([], PROXIMA);
    await atualizar();
    fixture.debugElement.injector.get(lista.loja).proximaPagina();
    await atualizar();
    const [corpo, opcoes] = problema(500, 'uniplus.erro');
    http.expectOne((r) => r.params.get('cursor') === 'proximo').flush(corpo, opcoes);
    await atualizar();
    return fixture;
  }

  describe.each(LISTAS)('$nome', (lista) => {
    it('a nova tentativa com cursor expirado recomeça da primeira página, em andamento até o fim', async () => {
      const fixture = await naSegundaPaginaEmFalha(lista);
      const host = fixture.nativeElement as HTMLElement;
      host.querySelector<HTMLButtonElement>('ui-alert button')?.click();
      await atualizar();

      const [corpo, opcoes] = problema(410, 'uniplus.cursor.expirado');
      http.expectOne((r) => r.params.get('cursor') === 'proximo').flush(corpo, opcoes);
      await Promise.resolve();
      const loja = fixture.debugElement.injector.get(lista.loja);
      expect(loja.carregando()).toBe(true);
      expect(loja.mensagemDeErro()).toBeNull();
      await atualizar();
      expect(host.querySelector('ui-alert [role="status"]')?.textContent).toBe(
        'Tentando novamente…',
      );
      expect(host.querySelector('ui-alert button')?.getAttribute('aria-disabled')).toBe('true');

      http.expectOne((r) => r.url.startsWith(lista.url) && !r.params.has('cursor')).flush([]);
      await atualizar();
      expect(host.querySelector('ui-alert')).toBeNull();
    });
  });
});
