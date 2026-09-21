import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  ReferenciaReservaDemograficaDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ReservaDemograficaListPage } from './reserva-demografica-list.page';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/referencias-reserva-demografica`;

const seed: ReferenciaReservaDemograficaDto = {
  id: '01960000-0000-7000-0000-0000000000e1',
  censoReferencia: '2022',
  ppiPercentual: 78.5,
  quilombolaPercentual: 1.2,
  pcdPercentual: 8.4,
  baseLegal: 'Lei 12.711/2012, art. 10, III',
  criadoEm: '2026-06-10T12:00:00Z',
};

describe('ReservaDemograficaListPage', () => {
  let fixture: ComponentFixture<ReservaDemograficaListPage>;
  let component: ReservaDemograficaListPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReservaDemograficaListPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(ReservaDemograficaListPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
  };

  async function flushLista(itens: readonly ReferenciaReservaDemograficaDto[]): Promise<void> {
    const req = controller.expectOne((r) => r.url === URL);
    expect(req.request.params.get('limit')).toBe('100');
    req.flush(itens);
    await propagate();
  }

  it('CA-01: renderiza a lista com Censo e percentuais formatados', async () => {
    await flushLista([seed]);
    expect(component['referenciasFiltradas']()).toHaveLength(1);
    fixture.detectChanges();
    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('2022');
    expect(texto).toContain('78.50');
    expect(texto).toContain('Ativa');
  });

  it('CA-01: busca por Censo filtra client-side', async () => {
    await flushLista([seed, { ...seed, id: 'x2', censoReferencia: '2010' }]);
    component['busca'].set('2010');
    expect(component['referenciasFiltradas']().map((r) => r.censoReferencia)).toEqual(['2010']);
  });

  it('envia null nos campos de texto preenchidos só com espaços', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    // `Validators.required` aceita espaços em branco: sem normalizar, o payload
    // levaria '' e o backend responderia sobre formato, não sobre ausência.
    component['form'].setValue({
      censoReferencia: '  ',
      ppiPercentual: 78.5,
      quilombolaPercentual: 1.2,
      pcdPercentual: 8.4,
      baseLegal: '   ',
    });
    component['salvar']();

    const post = controller.expectOne(
      `${BASE}/api/configuracao/admin/referencias-reserva-demografica`,
    );
    expect(post.request.body).toMatchObject({ censoReferencia: null, baseLegal: null });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([]);
  });

  it('CA-02: cria referência válida (POST com command)', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].setValue({
      censoReferencia: '2022',
      ppiPercentual: 78.5,
      quilombolaPercentual: 1.2,
      pcdPercentual: 8.4,
      baseLegal: 'Lei 12.711/2012, art. 10, III',
    });
    component['salvar']();

    const post = controller.expectOne(`${BASE}/api/configuracao/admin/referencias-reserva-demografica`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({
      censoReferencia: '2022',
      ppiPercentual: 78.5,
      quilombolaPercentual: 1.2,
      pcdPercentual: 8.4,
      baseLegal: 'Lei 12.711/2012, art. 10, III',
    });
    post.flush('new-id', { status: 201, statusText: 'Created' });
    await propagate();
    await flushLista([seed]);
    expect(component['formOpen']()).toBe(false);
  });

  it('CA-03: Censo duplicado marca erro no blur e bloqueia o submit', async () => {
    await flushLista([seed]);
    component['abrirCadastro']();
    component['form'].patchValue({ censoReferencia: '2022' });
    component['verificarCensoDuplicado']();

    expect(component['form'].controls.censoReferencia.hasError('duplicado')).toBe(true);
    component['salvar']();
    controller.expectNone(`${BASE}/api/configuracao/admin/referencias-reserva-demografica`);
  });

  it('CA-04: percentual fora de [0,100] é inválido; limites são aceitos', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    const ppi = component['form'].controls.ppiPercentual;
    ppi.setValue(-1);
    expect(ppi.invalid).toBe(true);
    ppi.setValue(100);
    expect(ppi.valid).toBe(true);
    ppi.setValue(0);
    expect(ppi.valid).toBe(true);
  });

  it('censo_ja_existe (409) é mapeado ao campo censoReferencia sem fechar o drawer', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].setValue({
      censoReferencia: '2022',
      ppiPercentual: 78.5,
      quilombolaPercentual: 1.2,
      pcdPercentual: 8.4,
      baseLegal: 'Lei 12.711/2012, art. 10, III',
    });
    component['salvar']();

    const post = controller.expectOne(
      `${BASE}/api/configuracao/admin/referencias-reserva-demografica`,
    );
    post.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.configuracao.referencia_reserva_demografica.censo_ja_existe',
        title: 'Já existe uma referência ativa para este Censo',
        status: 409,
        code: 'uniplus.configuracao.referencia_reserva_demografica.censo_ja_existe',
        traceId: 'test-trace',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['form'].controls.censoReferencia.errors?.['backend']).toBeTruthy();
    expect(component['formError']()).toBeNull();
  });

  it('outro 409 (processing_conflict) não hijacka censoReferencia e preserva o title do servidor', async () => {
    await flushLista([]);
    component['abrirCadastro']();
    component['form'].setValue({
      censoReferencia: '2022',
      ppiPercentual: 78.5,
      quilombolaPercentual: 1.2,
      pcdPercentual: 8.4,
      baseLegal: 'Lei 12.711/2012, art. 10, III',
    });
    component['salvar']();

    const post = controller.expectOne(
      `${BASE}/api/configuracao/admin/referencias-reserva-demografica`,
    );
    post.flush(
      JSON.stringify({
        type: 'https://uniplus.dev/erros/uniplus.idempotency.processing_conflict',
        title: 'Requisição original ainda está em processamento',
        status: 409,
        code: 'uniplus.idempotency.processing_conflict',
        traceId: 'test-trace',
      }),
      {
        status: 409,
        statusText: 'Conflict',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagate();

    expect(component['formOpen']()).toBe(true);
    expect(component['form'].controls.censoReferencia.errors).toBeNull();
    expect(component['formError']()).toBe('Requisição original ainda está em processamento');
  });

  it('CA-06: na edição, censoReferencia fica disabled', async () => {
    await flushLista([seed]);
    component['abrirEdicao'](seed);
    expect(component['form'].controls.censoReferencia.disabled).toBe(true);
    expect(component['form'].controls.ppiPercentual.disabled).toBe(false);
  });

  it('CA-07: inativar faz soft-delete (DELETE) e recarrega', async () => {
    await flushLista([seed]);
    component['pedirRemocao'](seed);
    component['removerConfirmado']();
    const req = controller.expectOne(`${BASE}/api/configuracao/admin/referencias-reserva-demografica/${seed.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    await flushLista([]);
  });

  it('expõe legenda acessível descrevendo a tabela', async () => {
    await flushLista([seed]);
    fixture.detectChanges();

    const caption = fixture.nativeElement.querySelector('table > caption');
    expect(caption).not.toBeNull();
    expect(caption?.classList.contains('sr-only')).toBe(true);
    expect(caption?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Reservas demográficas por censo, com percentuais de PPI, quilombola e PcD, base legal e situação',
    );
  });
});
