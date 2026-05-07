import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core';
import { EditalDto, SELECAO_BASE_PATH } from '@uniplus/shared-data';
import { EditaisDetailPage } from './editais-detail.page';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-000000000099';

const editalSeed = (overrides: Partial<EditalDto> = {}): EditalDto => ({
  id: ID,
  numeroEdital: '042/2026',
  titulo: 'PSE 2026',
  tipoProcesso: 'PSE',
  status: 'Rascunho',
  maximoOpcoesCurso: 2,
  bonusRegionalHabilitado: false,
  criadoEm: '2026-04-15T12:00:00Z',
  ...overrides,
});

describe('EditaisDetailPage', () => {
  let fixture: ComponentFixture<EditaisDetailPage>;
  let component: EditaisDetailPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EditaisDetailPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });

    fixture = TestBed.createComponent(EditaisDetailPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.componentRef.setInput('id', ID);
  });

  afterEach(() => controller.verify());

  // Helper: dreina o microtask queue para o `httpResource` propagar valores
  // aos signals após `controller.flush(...)`. `appRef.whenStable()` deadlocka
  // em testes de fixture com subscriptions ativas (publish flow); usar
  // `Promise.resolve()` é o equivalente sem Zone.js para "deixe microtasks
  // do signal scheduler rodarem antes da próxima asserção".
  const propagate = async () => {
    await Promise.resolve();
    appRef.tick();
  };

  it('carga inicial dispara GET /api/editais/{id} e popula data() do resource', async () => {
    fixture.detectChanges();

    const req = controller.expectOne(`${BASE}/api/editais/${ID}`);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.get('Accept')).toBe('application/vnd.uniplus.edital.v1+json');
    req.flush(editalSeed());
    await propagate();

    expect(component.edital()).toMatchObject({
      id: ID,
      titulo: 'PSE 2026',
      status: 'Rascunho',
    });
    expect(component.errorMessage()).toBeNull();
    expect(component.loading()).toBe(false);
  });

  it('404 problem+json popula errorMessage via problem-i18n e mantém edital=null', async () => {
    fixture.detectChanges();

    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(
      {
        type: 'about:blank',
        title: 'Edital não encontrado',
        status: 404,
        code: 'uniplus.selecao.edital.nao_encontrado',
        traceId: 'tx',
      },
      { status: 404, statusText: 'Not Found', headers: { 'Content-Type': 'application/problem+json' } },
    );
    await propagate();

    expect(component.edital()).toBeNull();
    expect(component.errorMessage()).toBe('Edital não encontrado');
  });

  it('podePublicar=true quando status === "Rascunho" (única transição permitida)', async () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Rascunho' }));
    await propagate();

    expect(component['podePublicar']()).toBe(true);
  });

  it('podePublicar=false quando status diferente de "Rascunho"', async () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Publicado' }));
    await propagate();

    expect(component['podePublicar']()).toBe(false);
  });

  it('_links.publicar no payload NUNCA habilita o botão (vedação ADR-0029 honrada — gate só por status)', async () => {
    fixture.detectChanges();
    // Cenário hipotético defensivo: backend (incorretamente) emite _links.publicar.
    // Frontend deve ignorar — gating é exclusivamente por status do recurso.
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush({
      ...editalSeed({ status: 'Publicado' }),
      _links: {
        self: `/api/editais/${ID}`,
        collection: '/api/editais',
        publicar: `/api/editais/${ID}/publicar`,
      },
    } as never);
    await propagate();

    expect(component['podePublicar']()).toBe(false);
  });

  it('_links navigation (self/collection) presente em recurso single per ADR-0029', async () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush({
      ...editalSeed({ status: 'Rascunho' }),
      _links: {
        self: `/api/editais/${ID}`,
        collection: '/api/editais',
      },
    });
    await propagate();

    expect(component.edital()?._links?.['self']).toBe(`/api/editais/${ID}`);
    expect(component.edital()?._links?.['collection']).toBe('/api/editais');
    // Action links nunca aparecem em _links (descobertos via OpenAPI).
    expect(component.edital()?._links?.['publicar']).toBeUndefined();
  });

  it('confirmarPublicacao envia POST com Idempotency-Key, recebe 204 e refetcha o edital', async () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Rascunho' }));
    await propagate();

    component['confirmarPublicacao']();
    expect(component.submitting()).toBe(true);

    const reqPublicar = controller.expectOne(`${BASE}/api/editais/${ID}/publicar`);
    expect(reqPublicar.request.method).toBe('POST');
    expect(reqPublicar.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    reqPublicar.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    // Refetch via editalResource.reload() — dispara novo GET preservando URL atual.
    const reqRefetch = controller.expectOne(`${BASE}/api/editais/${ID}`);
    reqRefetch.flush(editalSeed({ status: 'Publicado' }));
    await propagate();

    expect(component.submitting()).toBe(false);
    expect(component.mensagemSucesso()).toBe('Edital publicado com sucesso.');
    expect(component.edital()?.status).toBe('Publicado');
  });

  it('confirmarPublicacao com 422 ja_publicado popula errorMessage e NÃO refetcha', async () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Rascunho' }));
    await propagate();

    component['confirmarPublicacao']();
    controller.expectOne(`${BASE}/api/editais/${ID}/publicar`).flush(
      {
        type: 'about:blank',
        title: 'Edital já publicado',
        status: 422,
        code: 'uniplus.selecao.edital.ja_publicado',
        traceId: 'tx',
      },
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'Content-Type': 'application/problem+json' } },
    );
    await propagate();

    expect(component.errorMessage()).toBe('Edital já publicado');
    expect(component.mensagemSucesso()).toBeNull();
    // Sem refetch — controller.verify() do afterEach detecta requests pendentes.
  });

  it('botão Publicar aparece quando podePublicar=true e dispara dialog', async () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Rascunho' }));
    await propagate();
    fixture.detectChanges();

    const botao = fixture.debugElement.query(By.css('[data-testid="btn-publicar"]'));
    expect(botao).not.toBeNull();
    expect(component.dialogVisivel()).toBe(false);

    botao.nativeElement.click();
    expect(component.dialogVisivel()).toBe(true);
  });

  it('botão Publicar NÃO aparece quando podePublicar=false', async () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Publicado' }));
    await propagate();
    fixture.detectChanges();

    const botao = fixture.debugElement.query(By.css('[data-testid="btn-publicar"]'));
    expect(botao).toBeNull();
  });

  it('mudança no input id cancela GET stale e dispara nova request (httpResource race-cancellation nativa)', async () => {
    fixture.detectChanges();
    const reqId1 = controller.expectOne(`${BASE}/api/editais/${ID}`);
    expect(reqId1.cancelled).toBe(false);

    // Usuário navega antes do id1 retornar — Angular reusa a instância do componente.
    const ID_NOVO = '01960000-0000-7000-0000-000000000bbb';
    fixture.componentRef.setInput('id', ID_NOVO);
    fixture.detectChanges();
    // Drena microtasks do scheduler de signals — sem isto o assert de
    // cancellation pode ser flaky se o httpResource scheduler atrasar o
    // unsubscribe da request stale para a próxima microtask.
    await propagate();

    // httpResource cancela a request anterior automaticamente quando dependências
    // reativas mudam — substitui o race guard manual ("if (this.id() !== id) return")
    // do pattern legado.
    expect(reqId1.cancelled).toBe(true);

    const reqId2 = controller.expectOne(`${BASE}/api/editais/${ID_NOVO}`);
    reqId2.flush(editalSeed({ id: ID_NOVO, titulo: 'PSE 2027' }));
    await propagate();

    expect(component.edital()?.titulo).toBe('PSE 2027');
    expect(component.loading()).toBe(false);
  });

  it('confirmarPublicacao ignora chamada dupla enquanto submitting=true (guard de double-submit)', async () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Rascunho' }));
    await propagate();

    component['confirmarPublicacao']();
    // Segunda chamada antes do flush do POST — guard ignora silenciosamente.
    component['confirmarPublicacao']();

    // Deve haver exatamente 1 POST em voo, não 2 — caso contrário o
    // expectOne lançaria "Match URL ... found 2 requests" e o teste falharia.
    controller
      .expectOne(`${BASE}/api/editais/${ID}/publicar`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagate();

    controller
      .expectOne(`${BASE}/api/editais/${ID}`)
      .flush(editalSeed({ status: 'Publicado' }));
    await propagate();

    expect(component.submitting()).toBe(false);
    expect(component.mensagemSucesso()).toBe('Edital publicado com sucesso.');
  });

  it('mudança no input id zera mensagemSucesso e errorMessage do publish anterior', async () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Rascunho' }));
    await propagate();

    // Simula publish bem-sucedido — popula mensagemSucesso.
    component['confirmarPublicacao']();
    controller
      .expectOne(`${BASE}/api/editais/${ID}/publicar`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    controller
      .expectOne(`${BASE}/api/editais/${ID}`)
      .flush(editalSeed({ status: 'Publicado' }));
    await propagate();
    expect(component.mensagemSucesso()).toBe('Edital publicado com sucesso.');

    // Navegação para outro :id sem destruir o componente.
    const ID_NOVO = '01960000-0000-7000-0000-000000000aaa';
    fixture.componentRef.setInput('id', ID_NOVO);
    fixture.detectChanges();

    // Effect zera signals locais (publish flow); httpResource zera value() automaticamente.
    expect(component.mensagemSucesso()).toBeNull();
    expect(component.edital()).toBeNull();
    expect(component.loading()).toBe(true);

    controller
      .expectOne(`${BASE}/api/editais/${ID_NOVO}`)
      .flush(editalSeed({ id: ID_NOVO, titulo: 'PSE 2027' }));
    await propagate();
    expect(component.edital()?.titulo).toBe('PSE 2027');
  });
});
