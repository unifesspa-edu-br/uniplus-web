import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
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
    fixture.componentRef.setInput('id', ID);
  });

  afterEach(() => controller.verify());

  it('carga inicial dispara GET /api/editais/{id} e popula o signal edital', () => {
    fixture.detectChanges();

    const req = controller.expectOne(`${BASE}/api/editais/${ID}`);
    expect(req.request.method).toBe('GET');
    req.flush(editalSeed());

    expect(component.edital()).toMatchObject({
      id: ID,
      titulo: 'PSE 2026',
      status: 'Rascunho',
    });
    expect(component.errorMessage()).toBeNull();
    expect(component.loading()).toBe(false);
  });

  it('404 problem+json popula errorMessage via problem-i18n e zera edital', () => {
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

    expect(component.edital()).toBeNull();
    expect(component.errorMessage()).toBe('Edital não encontrado');
  });

  it('podePublicar=true quando _links.publicar está presente (caminho A HATEOAS)', () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush({
      ...editalSeed({ status: 'Publicado' }),
      _links: {
        self: `/api/editais/${ID}`,
        publicar: `/api/editais/${ID}/publicar`,
      },
    });

    // _links.publicar wins sobre status — backend é a única fonte da regra.
    expect(component['podePublicar']()).toBe(true);
  });

  it('podePublicar=false quando _links presente mas sem .publicar (status irrelevante)', () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush({
      ...editalSeed({ status: 'Rascunho' }),
      _links: { self: `/api/editais/${ID}` },
    });

    expect(component['podePublicar']()).toBe(false);
  });

  it('fallback temporário (uniplus-api#334): sem _links, podePublicar=true se status=Rascunho', () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Rascunho' }));

    expect(component['podePublicar']()).toBe(true);
  });

  it('fallback: sem _links, podePublicar=false se status diferente de Rascunho', () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Publicado' }));

    expect(component['podePublicar']()).toBe(false);
  });

  it('confirmarPublicacao envia POST com Idempotency-Key, recebe 204 e refetcha o edital', () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Rascunho' }));

    component['confirmarPublicacao']();
    expect(component.submitting()).toBe(true);

    const reqPublicar = controller.expectOne(`${BASE}/api/editais/${ID}/publicar`);
    expect(reqPublicar.request.method).toBe('POST');
    expect(reqPublicar.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    reqPublicar.flush(null, { status: 204, statusText: 'No Content' });

    // Refetch dispara novo GET
    const reqRefetch = controller.expectOne(`${BASE}/api/editais/${ID}`);
    reqRefetch.flush(editalSeed({ status: 'Publicado' }));

    expect(component.submitting()).toBe(false);
    expect(component.mensagemSucesso()).toBe('Edital publicado com sucesso.');
    expect(component.edital()?.status).toBe('Publicado');
  });

  it('confirmarPublicacao com 422 ja_publicado popula errorMessage e NÃO refetcha', () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Rascunho' }));

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

    expect(component.errorMessage()).toBe('Edital já publicado');
    expect(component.mensagemSucesso()).toBeNull();
    // Sem refetch — controller.verify() do afterEach detecta requests pendentes.
  });

  it('botão Publicar aparece quando podePublicar=true e dispara dialog', () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Rascunho' }));
    fixture.detectChanges();

    const botao = fixture.debugElement.query(By.css('[data-testid="btn-publicar"]'));
    expect(botao).not.toBeNull();
    expect(component.dialogVisivel()).toBe(false);

    botao.nativeElement.click();
    expect(component.dialogVisivel()).toBe(true);
  });

  it('botão Publicar NÃO aparece quando podePublicar=false', () => {
    fixture.detectChanges();
    controller.expectOne(`${BASE}/api/editais/${ID}`).flush(editalSeed({ status: 'Publicado' }));
    fixture.detectChanges();

    const botao = fixture.debugElement.query(By.css('[data-testid="btn-publicar"]'));
    expect(botao).toBeNull();
  });
});
