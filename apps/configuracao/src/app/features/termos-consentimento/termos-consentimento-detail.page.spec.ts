import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  CONFIGURACAO_BASE_PATH,
  type TermoConsentimentoDto,
} from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TermosConsentimentoDetailPage } from './termos-consentimento-detail.page';

const BASE = 'http://localhost:5000';
const TERMO_ID = '01960000-0000-7000-0000-0000000000a1';
const DETALHE_PATH = `${BASE}/api/configuracao/termos-consentimento/${TERMO_ID}`;

function termo(overrides: Partial<TermoConsentimentoDto> = {}): TermoConsentimentoDto {
  return {
    id: TERMO_ID,
    nome: 'Declaração de veracidade',
    textoRascunho: 'Declaro que as informações são verdadeiras.',
    baseLegalRascunho: 'Lei nº 13.709/2018',
    formaAceiteRascunho: 'A_DEFINIR',
    revisado: false,
    revisadoEm: null,
    versoes: [],
    criadoEm: '2026-08-11T12:00:00Z',
    ...overrides,
  };
}

function problem(code: string, title: string): Record<string, unknown> {
  return {
    type: `https://uniplus.dev/erros/${code}`,
    title,
    status: 422,
    code,
  };
}

const PROBLEM_HEADERS = { 'Content-Type': 'application/problem+json' };

describe('TermosConsentimentoDetailPage', () => {
  let fixture: ComponentFixture<TermosConsentimentoDetailPage>;
  let component: TermosConsentimentoDetailPage;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TermosConsentimentoDetailPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: TERMO_ID }) } },
        },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(TermosConsentimentoDetailPage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  const propagate = async (): Promise<void> => {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  };

  async function carregarTermo(dados = termo()): Promise<void> {
    controller.expectOne(DETALHE_PATH).flush(dados);
    await propagate();
  }

  it('desabilita os campos enquanto o rascunho está sendo salvo', async () => {
    await carregarTermo();

    component['rascunhoForm'].controls.texto.setValue('Texto revisado');
    component['salvarRascunho']();
    fixture.detectChanges();

    const campos = fixture.nativeElement.querySelector<HTMLFieldSetElement>(
      '.cfg-termo-consentimento__campos',
    );
    expect(campos?.disabled).toBe(true);

    const salvar = controller.expectOne(
      `${BASE}/api/configuracao/admin/termos-consentimento/${TERMO_ID}/rascunho`,
    );
    salvar.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    controller.expectOne(DETALHE_PATH).flush(termo({ textoRascunho: 'Texto revisado' }));
    await propagate();
  });

  it('renova a Idempotency-Key após 422 para repetir a revisão como novo comando', async () => {
    await carregarTermo();

    component['marcarRevisado']();
    const primeira = controller.expectOne(
      `${BASE}/api/configuracao/admin/termos-consentimento/${TERMO_ID}/revisar`,
    );
    const chaveInicial = primeira.request.headers.get('Idempotency-Key');
    primeira.flush(
      problem('uniplus.configuracao.termo_consentimento.revisao_sem_texto', 'Rascunho inválido'),
      { status: 422, statusText: 'Unprocessable Entity', headers: PROBLEM_HEADERS },
    );
    await propagate();

    component['marcarRevisado']();
    const segunda = controller.expectOne(
      `${BASE}/api/configuracao/admin/termos-consentimento/${TERMO_ID}/revisar`,
    );
    expect(chaveInicial).toBeTruthy();
    expect(segunda.request.headers.get('Idempotency-Key')).not.toBe(chaveInicial);
    segunda.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    controller
      .expectOne(DETALHE_PATH)
      .flush(termo({ revisado: true, revisadoEm: '2026-08-11T13:00:00Z' }));
    await propagate();
  });

  it('descarta a leitura antiga quando salvar e revisar terminam em sequência', async () => {
    await carregarTermo();

    component['salvarRascunho']();
    const salvar = controller.expectOne(
      `${BASE}/api/configuracao/admin/termos-consentimento/${TERMO_ID}/rascunho`,
    );
    salvar.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    const leituraDoSalvamento = controller.expectOne(DETALHE_PATH);

    component['marcarRevisado']();
    const revisar = controller.expectOne(
      `${BASE}/api/configuracao/admin/termos-consentimento/${TERMO_ID}/revisar`,
    );
    revisar.flush(null, { status: 204, statusText: 'No Content' });
    await propagate();
    const leituraDaRevisao = controller.expectOne(DETALHE_PATH);

    leituraDaRevisao.flush(termo({ revisado: true, revisadoEm: '2026-08-11T13:00:00Z' }));
    await propagate();
    leituraDoSalvamento.flush(termo({ revisado: false, revisadoEm: null }));
    await propagate();

    expect(component['termo']()?.revisado).toBe(true);
  });

  it('expõe o motivo dos botões indisponíveis por tooltip focável', async () => {
    await carregarTermo(
      termo({
        versoes: [
          {
            id: '01960000-0000-7000-0000-0000000000a2',
            texto: 'Declaro que as informações são verdadeiras.',
            baseLegal: 'Lei nº 13.709/2018',
            formaAceite: 'A_DEFINIR',
            hash: 'abc123',
            promovidaEm: '2026-08-11T13:00:00Z',
          },
        ],
      }),
    );

    const promocao = fixture.nativeElement.querySelector<HTMLElement>(
      '[aria-label="Promover a versão indisponível"]',
    );
    expect(promocao?.getAttribute('tabindex')).toBe('0');
    expect(promocao?.getAttribute('data-tooltip')).toContain('Marque o rascunho como revisado');
    expect(promocao?.getAttribute('aria-describedby')).toBe(
      'cfg-termo-consentimento-motivo-promocao',
    );

    const remocao = fixture.nativeElement.querySelector<HTMLElement>(
      '[aria-label="Remover termo indisponível"]',
    );
    expect(remocao?.getAttribute('tabindex')).toBe('0');
    expect(remocao?.getAttribute('data-tooltip')).toContain('Termo com versão promovida');
    expect(
      fixture.nativeElement.querySelector('#cfg-termo-consentimento-motivo-remocao')?.textContent,
    ).toContain('Termo com versão promovida');
  });
});
