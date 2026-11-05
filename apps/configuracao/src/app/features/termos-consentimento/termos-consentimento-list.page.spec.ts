import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  TermoConsentimentoResumoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TermosConsentimentoStore } from './termos-consentimento.store';
import { TermosConsentimentoListPage } from './termos-consentimento-list.page';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/termos-consentimento`;

function termoResumo(over: Partial<TermoConsentimentoResumoDto> = {}): TermoConsentimentoResumoDto {
  return {
    id: over.id ?? crypto.randomUUID(),
    nome: 'Termo de Privacidade LGPD',
    formaAceiteRascunho: 'REGISTRO_DIGITAL_COM_LOG_IP',
    revisado: true,
    criadoEm: '2026-08-13T10:00:00Z',
    ...over,
  };
}

const LGPD = termoResumo({ id: 'id-lgpd', nome: 'Termo LGPD' });
const USO_IMAGEM = termoResumo({ id: 'id-uso-imagem', nome: 'Uso de Imagem', revisado: false });

describe('TermosConsentimentoListPage', () => {
  let fixture: ComponentFixture<TermosConsentimentoListPage>;
  let store: TermosConsentimentoStore;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TermosConsentimentoListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([{ path: 'termos-consentimento', children: [] }]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    controller.verify();
  });

  async function propagar(): Promise<void> {
    await Promise.resolve();
    TestBed.inject(ApplicationRef).tick();
    fixture.detectChanges();
  }

  async function montar(
    itens: readonly TermoConsentimentoResumoDto[] = [LGPD, USO_IMAGEM],
    headers?: Record<string, string>,
  ): Promise<void> {
    fixture = TestBed.createComponent(TermosConsentimentoListPage);
    store = fixture.debugElement.injector.get(TermosConsentimentoStore);
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const req = controller.expectOne((r) => r.url === URL && r.params.get('limit') === '50');
    req.flush([...itens], { headers });
    await propagar();
    await propagar();
  }

  it('carrega a lista inicial de termos de consentimento', async () => {
    await montar();
    expect(store.termos().length).toBe(2);
    expect(store.termos()[0].nome).toBe('Termo LGPD');
  });

  it('aplica debounce de 300ms e normaliza com trim ao alterar a busca', async () => {
    vi.useFakeTimers();
    await montar();

    store.alterarBusca('  lgpd  ');

    vi.advanceTimersByTime(200);
    await propagar();
    controller.expectNone((r) => r.url === URL && r.params.has('q'));

    vi.advanceTimersByTime(100);
    await propagar();
    const req = controller.expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd');
    req.flush([LGPD]);
    await propagar();

    expect(store.termos().length).toBe(1);
  });

  it('limpa filtros, cancela o debounce pendente e permite repetir o mesmo termo', async () => {
    vi.useFakeTimers();
    await montar();

    store.alterarBusca('lgpd');
    vi.advanceTimersByTime(150);
    await propagar();

    store.limparFiltros();
    await propagar();

    const req = controller.expectOne((r) => r.url === URL && !r.params.has('q'));
    req.flush([LGPD, USO_IMAGEM]);
    await propagar();

    vi.advanceTimersByTime(150);
    await propagar();
    controller.expectNone((r) => r.url === URL && r.params.get('q') === 'lgpd');
    expect(store.busca()).toBe('');

    store.alterarBusca('lgpd');
    vi.advanceTimersByTime(300);
    await propagar();

    controller.expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd').flush([LGPD]);
  });

  it('ignora disparos se o termo normalizado for idêntico', async () => {
    vi.useFakeTimers();
    await montar();

    store.alterarBusca('lgpd');
    vi.advanceTimersByTime(300);
    await propagar();
    controller.expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd').flush([LGPD]);

    store.alterarBusca('lgpd ');
    vi.advanceTimersByTime(300);
    await propagar();

    controller.expectNone((r) => r.url === URL && r.params.get('q') === 'lgpd');
  });

  it('zera cursores e lista imediatamente ao aplicar um novo filtro', async () => {
    await montar();

    vi.useFakeTimers();
    store.alterarBusca('novo-termo');
    vi.advanceTimersByTime(300);
    await propagar();

    expect(store.prevCursor()).toBeNull();
    expect(store.nextCursor()).toBeNull();
    expect(store.termos()).toEqual([]);

    const req = controller.expectOne((r) => r.url === URL && r.params.get('q') === 'novo-termo');
    req.flush([LGPD]);
    await propagar();
  });

  it('navega pelas páginas utilizando cursores obtidos do header Link', async () => {
    const linkHeader =
      '<http://localhost:5000/api/configuracao/termos-consentimento?cursor=next-123&direction=next>; rel="next"';
    await montar([LGPD], { Link: linkHeader });

    expect(store.nextCursor()).toBe('next-123');

    store.proximaPagina();
    await propagar();
    const req = controller.expectOne(
      (r) =>
        r.url === URL &&
        r.params.get('cursor') === 'next-123' &&
        r.params.get('direction') === 'next',
    );
    req.flush([USO_IMAGEM], {
      headers: {
        Link: '<http://localhost:5000/api/configuracao/termos-consentimento?cursor=prev-456&direction=prev>; rel="prev"',
      },
    });

    await propagar();
    expect(store.prevCursor()).toBe('prev-456');
  });

  it('preserva o filtro ao navegar para a próxima página', async () => {
    vi.useFakeTimers();
    await montar();

    store.alterarBusca('lgpd');
    vi.advanceTimersByTime(300);
    await propagar();
    controller
      .expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd')
      .flush([LGPD], {
        headers: {
          Link: '<http://localhost:5000/api/configuracao/termos-consentimento?cursor=next-filtered&direction=next>; rel="next"',
        },
      });
    await propagar();

    store.proximaPagina();
    await propagar();

    controller
      .expectOne(
        (r) =>
          r.url === URL &&
          r.params.get('q') === 'lgpd' &&
          r.params.get('cursor') === 'next-filtered' &&
          r.params.get('direction') === 'next',
      )
      .flush([]);
  });

  it('ignora resposta atrasada de um filtro anterior', async () => {
    vi.useFakeTimers();
    await montar();

    store.alterarBusca('lgpd');
    vi.advanceTimersByTime(300);
    await propagar();
    const reqAnterior = controller.expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd');

    store.alterarBusca('imagem');
    vi.advanceTimersByTime(300);
    await propagar();
    const reqAtual = controller.expectOne((r) => r.url === URL && r.params.get('q') === 'imagem');

    reqAtual.flush([USO_IMAGEM]);
    await propagar();
    expect(reqAnterior.cancelled).toBe(true);

    expect(store.termos()).toEqual([USO_IMAGEM]);
  });

  it('exibe erro ao falhar carregamento e permite tentar novamente', async () => {
    fixture = TestBed.createComponent(TermosConsentimentoListPage);
    store = fixture.debugElement.injector.get(TermosConsentimentoStore);
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    const req1 = controller.expectOne((r) => r.url === URL);
    req1.flush(
      { type: 'https://uniplus.dev/erros/500', title: 'Erro de conexão', status: 500 },
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/problem+json' },
      },
    );

    await propagar();
    expect(store.errorMessage()).toBeTruthy();

    store.tentarNovamente();
    await propagar();
    const req2 = controller.expectOne((r) => r.url === URL);
    req2.flush([LGPD]);
    await propagar();

    expect(store.errorMessage()).toBeNull();
    expect(store.termos().length).toBe(1);
  });
  it('expõe legenda acessível descrevendo a tabela', async () => {
    await montar();
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/gu, ' ').trim()).toBe(
      'Termos de consentimento, com forma de aceite e status de revisão',
    );
  });

  it('a ação de abrir possui ícone, tooltip, nome acessível e leva ao termo', async () => {
    await montar();
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      'ui-icon-button[icon="pi-folder-open"] a[aria-label="Abrir termo de consentimento Termo LGPD"]',
    );

    expect(link).not.toBeNull();
    expect(link?.querySelector('i')?.classList.contains('pi-folder-open')).toBe(true);
    expect(link?.getAttribute('data-tooltip')).toBe('Abrir termo de consentimento');
    expect(link?.getAttribute('href')).toMatch(/id-lgpd$/u);
  });
});
