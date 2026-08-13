import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  TermoConsentimentoResumoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  let component: TermosConsentimentoListPage;
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

  function montar(
    itens: readonly TermoConsentimentoResumoDto[] = [LGPD, USO_IMAGEM],
    headers?: Record<string, string>,
  ): void {
    fixture = TestBed.createComponent(TermosConsentimentoListPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const req = controller.expectOne((r) => r.url === URL && r.params.get('limit') === '50');
    req.flush([...itens], { headers });
  }

  it('carrega a lista inicial de termos de consentimento', () => {
    montar();
    expect(component['termosFiltrados']().length).toBe(2);
    expect(component['termosFiltrados']()[0].nome).toBe('Termo LGPD');
  });

  it('aplica debounce de 300ms e normaliza com trim ao alterar a busca', () => {
    vi.useFakeTimers();
    montar();

    component['alterarBusca']('  lgpd  ');

    vi.advanceTimersByTime(200);
    controller.expectNone((r) => r.url === URL && r.params.has('q'));

    vi.advanceTimersByTime(100);
    const req = controller.expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd');
    req.flush([LGPD]);

    expect(component['termosFiltrados']().length).toBe(1);
  });

  it('limpa filtros, cancela o debounce pendente e permite repetir o mesmo termo', () => {
    vi.useFakeTimers();
    montar();

    component['alterarBusca']('lgpd');
    vi.advanceTimersByTime(150);

    component['limparFiltros']();

    const req = controller.expectOne((r) => r.url === URL && !r.params.has('q'));
    req.flush([LGPD, USO_IMAGEM]);

    vi.advanceTimersByTime(150);
    controller.expectNone((r) => r.url === URL && r.params.get('q') === 'lgpd');
    expect(component['busca']()).toBe('');

    component['alterarBusca']('lgpd');
    vi.advanceTimersByTime(300);

    controller.expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd').flush([LGPD]);
  });

  it('ignora disparos se o termo normalizado for idêntico', () => {
    vi.useFakeTimers();
    montar();

    component['alterarBusca']('lgpd');
    vi.advanceTimersByTime(300);
    controller.expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd').flush([LGPD]);

    component['alterarBusca']('lgpd ');
    vi.advanceTimersByTime(300);

    controller.expectNone((r) => r.url === URL && r.params.get('q') === 'lgpd');
  });

  it('zera cursores e lista imediatamente ao aplicar um novo filtro', () => {
    montar();

    component['aplicarNovoFiltro']('novo-termo');

    expect(component['prevCursor']()).toBeNull();
    expect(component['nextCursor']()).toBeNull();
    expect(component['termosFiltrados']()).toEqual([]);

    const req = controller.expectOne((r) => r.url === URL && r.params.get('q') === 'novo-termo');
    req.flush([LGPD]);
  });

  it('navega pelas páginas utilizando cursores obtidos do header Link', () => {
    const linkHeader =
      '<http://localhost:5000/api/configuracao/termos-consentimento?cursor=next-123&direction=next>; rel="next"';
    montar([LGPD], { Link: linkHeader });

    expect(component['nextCursor']()).toBe('next-123');

    component['proximaPagina']();
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

    expect(component['prevCursor']()).toBe('prev-456');
  });

  it('preserva o filtro ao navegar para a próxima página', () => {
    vi.useFakeTimers();
    montar();

    component['alterarBusca']('lgpd');
    vi.advanceTimersByTime(300);
    controller
      .expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd')
      .flush([LGPD], {
        headers: {
          Link: '<http://localhost:5000/api/configuracao/termos-consentimento?cursor=next-filtered&direction=next>; rel="next"',
        },
      });

    component['proximaPagina']();

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

  it('ignora resposta atrasada de um filtro anterior', () => {
    vi.useFakeTimers();
    montar();

    component['alterarBusca']('lgpd');
    vi.advanceTimersByTime(300);
    const reqAnterior = controller.expectOne((r) => r.url === URL && r.params.get('q') === 'lgpd');

    component['alterarBusca']('imagem');
    vi.advanceTimersByTime(300);
    const reqAtual = controller.expectOne((r) => r.url === URL && r.params.get('q') === 'imagem');

    reqAtual.flush([USO_IMAGEM]);
    reqAnterior.flush([LGPD]);

    expect(component['termosFiltrados']()).toEqual([USO_IMAGEM]);
  });

  it('exibe erro ao falhar carregamento e permite tentar novamente', () => {
    fixture = TestBed.createComponent(TermosConsentimentoListPage);
    component = fixture.componentInstance;
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

    expect(component['errorMessage']()).toBeTruthy();

    component['tentarNovamente']();
    const req2 = controller.expectOne((r) => r.url === URL);
    req2.flush([LGPD]);

    expect(component['errorMessage']()).toBeNull();
    expect(component['termosFiltrados']().length).toBe(1);
  });
});
