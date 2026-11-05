import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH, TermoConsentimentoDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EdicaoDosTermosConsentimento } from './edicao-dos-termos-consentimento';
import { TermosConsentimentoDetailPage } from './termos-consentimento-detail.page';

const BASE = 'http://localhost:5000';
const ID = '01960000-0000-7000-0000-0000000000a1';
const LEITURA = `${BASE}/api/configuracao/termos-consentimento/${ID}`;
const ESCRITA = `${BASE}/api/configuracao/admin/termos-consentimento`;
const termo: TermoConsentimentoDto = {
  id: ID,
  nome: 'Declaração de veracidade',
  textoRascunho: 'Declaro que são verdadeiras.',
  baseLegalRascunho: 'Lei nº 13.709/2018',
  formaAceiteRascunho: 'A_DEFINIR',
  revisado: false,
  revisadoEm: null,
  versoes: [],
  criadoEm: '2026-08-11T12:00:00Z',
};

describe('TermosConsentimentoDetailPage — escritas pela interface', () => {
  let fixture: ComponentFixture<TermosConsentimentoDetailPage>;
  let edicao: EdicaoDosTermosConsentimento;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TermosConsentimentoDetailPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: ID }) } },
        },
      ],
    });
    fixture = TestBed.createComponent(TermosConsentimentoDetailPage);
    edicao = fixture.debugElement.injector.get(EdicaoDosTermosConsentimento);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    controller.expectOne(LEITURA).flush(termo);
    await propagar();
  });
  afterEach(() => controller.verify());

  async function propagar(): Promise<void> {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  }
  function elemento<T extends HTMLElement>(seletor: string): T {
    const el = fixture.nativeElement.querySelector(seletor) as T | null;
    expect(el, seletor).not.toBeNull();
    return el as T;
  }
  function salvar(): void {
    elemento<HTMLFormElement>('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
  }
  async function abrirRemocao(): Promise<void> {
    elemento<HTMLButtonElement>('.btn--danger').click();
    await propagar();
  }
  it('envio mantém foco e valores, desabilita o fieldset e recusa novas ativações', async () => {
    const botao = elemento<HTMLButtonElement>('button[type="submit"]');
    botao.focus();
    salvar();
    await propagar();
    expect(elemento<HTMLFieldSetElement>('fieldset').disabled).toBe(true);
    expect(elemento<HTMLTextAreaElement>('textarea').value).toBe(termo.textoRascunho);
    expect(edicao.rascunhoForm.controls.texto.enabled).toBe(true);
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(botao.textContent).toContain('Salvando...');
    expect(document.activeElement).toBe(botao);
    salvar();
    elemento<HTMLFormElement>('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    const requisicoes = controller.match(`${ESCRITA}/${ID}/rascunho`);
    expect(requisicoes).toHaveLength(1);
    requisicoes[0].flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne(LEITURA).flush(termo);
    await propagar();
  });

  it('recusa mostra o erro no campo e move o foco até ele', async () => {
    salvar();
    controller.expectOne(`${ESCRITA}/${ID}/rascunho`).flush(
      {
        type: 'about:blank',
        title: 'Dados inválidos',
        status: 422,
        code: 'uniplus.validacao',
        errors: [
          {
            field: 'textoRascunho',
            code: 'uniplus.configuracao.termo_consentimento.invalido',
            message: 'Texto recusado.',
          },
        ],
      },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar();
    await new Promise((resolve) => setTimeout(resolve));
    const texto = elemento<HTMLTextAreaElement>('textarea');
    expect(texto.getAttribute('aria-invalid')).toBe('true');
    expect(texto.closest('label')?.textContent).toContain('Texto recusado.');
    expect(document.activeElement).toBe(texto);
  });

  it('associa os erros e as dicas aos campos do rascunho', async () => {
    for (const controle of Object.values(edicao.rascunhoForm.controls)) {
      controle.setErrors({ backend: { message: 'Campo recusado.' } });
      controle.markAsTouched();
    }
    await propagar();
    for (const nome of ['texto', 'baseLegal', 'formaAceite']) {
      const campo = elemento<HTMLElement>(`[formcontrolname="${nome}"]`);
      const ids = campo.getAttribute('aria-describedby')?.split(' ') ?? [];
      expect(ids.map((id) => document.getElementById(id)?.textContent).join(' ')).toContain(
        'Campo recusado.',
      );
      if (nome !== 'baseLegal') expect(ids).toHaveLength(2);
    }
  });

  it('mantém a recusa no diálogo e permite tentar novamente ou cancelar', async () => {
    await abrirRemocao();
    const dialog = elemento<HTMLDialogElement>('dialog');
    const confirmar = elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]');
    confirmar.click();
    controller
      .expectOne(`${ESCRITA}/${ID}`)
      .flush(
        { type: 'about:blank', title: 'Remoção recusada', status: 422, code: 'uniplus.validacao' },
        {
          status: 422,
          statusText: 'Unprocessable Entity',
          headers: { 'content-type': 'application/problem+json' },
        },
      );
    await propagar();
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('[role="status"]')?.textContent).toContain('Remoção recusada');
    confirmar.click();
    const tentativa = controller.expectOne(`${ESCRITA}/${ID}`);
    await propagar();
    expect(dialog.querySelector('[role="status"]')?.textContent).toContain('Removendo');
    tentativa.flush(
      { type: 'about:blank', title: 'Remoção recusada', status: 422, code: 'uniplus.validacao' },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar();
    elemento<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]').click();
    await propagar();
    expect(dialog.open).toBe(false);
  });

  it('remoção anuncia o andamento e impede confirmar ou fechar novamente', async () => {
    await abrirRemocao();
    const dialog = elemento<HTMLDialogElement>('dialog');
    const confirmar = elemento<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]');
    confirmar.click();
    const requisicao = controller.expectOne(`${ESCRITA}/${ID}`);
    await propagar();
    expect(elemento('[role="status"]').textContent).toContain(
      'Removendo o termo Declaração de veracidade.',
    );
    expect(confirmar.getAttribute('aria-disabled')).toBe('true');
    edicao.salvarRascunho();
    edicao.marcarRevisado();
    controller.expectNone(`${ESCRITA}/${ID}/rascunho`);
    controller.expectNone(`${ESCRITA}/${ID}/revisar`);
    confirmar.click();
    elemento<HTMLButtonElement>('[data-testid="confirm-dialog-close"]').click();
    elemento<HTMLButtonElement>('[data-testid="confirm-dialog-cancel"]').click();
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    await propagar();
    expect(dialog.open).toBe(true);
    controller.expectNone(`${ESCRITA}/${ID}`);
    requisicao.flush(
      { type: 'about:blank', title: 'Recusado', status: 422, code: 'uniplus.validacao' },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
    await propagar();
  });

  it('escritas concorrentes são recusadas durante salvamento e recarga', async () => {
    salvar();
    edicao.salvarRascunho();
    edicao.marcarRevisado();
    edicao.pedirRemocao();
    edicao.removerConfirmado();
    controller.expectNone(`${ESCRITA}/${ID}/revisar`);
    controller.expectNone(`${ESCRITA}/${ID}`);
    controller
      .expectOne(`${ESCRITA}/${ID}/rascunho`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    const recarga = controller.expectOne(LEITURA);
    edicao.marcarRevisado();
    edicao.salvarRascunho();
    controller.expectNone(`${ESCRITA}/${ID}/revisar`);
    controller.expectNone(`${ESCRITA}/${ID}/rascunho`);
    recarga.flush(termo);
    await propagar();
    edicao.marcarRevisado();
    controller
      .expectOne(`${ESCRITA}/${ID}/revisar`)
      .flush(null, { status: 204, statusText: 'No Content' });
    await propagar();
    controller.expectOne(LEITURA).flush({ ...termo, revisado: true });
    await propagar();
  });
});

describe('TermosConsentimentoDetailPage — criação pela interface', () => {
  let fixture: ComponentFixture<TermosConsentimentoDetailPage>;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TermosConsentimentoDetailPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
      ],
    });
    fixture = TestBed.createComponent(TermosConsentimentoDetailPage);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
  });
  afterEach(() => controller.verify());

  function elemento<T extends HTMLElement>(seletor: string): T {
    const el = fixture.nativeElement.querySelector(seletor) as T | null;
    expect(el, seletor).not.toBeNull();
    return el as T;
  }

  it('associa os erros e as dicas aos campos da criação', () => {
    const edicao = fixture.debugElement.injector.get(EdicaoDosTermosConsentimento);
    for (const controle of Object.values(edicao.criarForm.controls)) {
      controle.setErrors({ backend: { message: 'Campo recusado.' } });
      controle.markAsTouched();
    }
    fixture.detectChanges();
    for (const nome of ['nome', 'texto', 'baseLegal', 'formaAceite']) {
      const campo = elemento<HTMLElement>(`[formcontrolname="${nome}"]`);
      const ids = campo.getAttribute('aria-describedby')?.split(' ') ?? [];
      expect(ids.map((id) => document.getElementById(id)?.textContent).join(' ')).toContain(
        'Campo recusado.',
      );
      if (nome === 'texto' || nome === 'formaAceite') expect(ids).toHaveLength(2);
    }
  });

  it('mantém campos e navegação indisponíveis durante a criação e recusa reenvios', async () => {
    const root = fixture.nativeElement as HTMLElement;
    const nome = elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    nome.value = 'Declaração de veracidade';
    nome.dispatchEvent(new Event('input'));
    const botao = elemento<HTMLButtonElement>('button[type="submit"]');
    botao.focus();
    elemento<HTMLFormElement>('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
    expect(root.querySelector<HTMLFieldSetElement>('fieldset')?.disabled).toBe(true);
    expect(nome.value).toBe('Declaração de veracidade');
    expect(botao.getAttribute('aria-disabled')).toBe('true');
    expect(botao.getAttribute('aria-busy')).toBe('true');
    expect(botao.textContent).toContain('Criando...');
    expect(document.activeElement).toBe(botao);
    const voltar = elemento<HTMLAnchorElement>('.cfg-voltar');
    expect(voltar.getAttribute('aria-disabled')).toBe('true');
    botao.click();
    elemento<HTMLFormElement>('form').dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    const requisicoes = controller.match(ESCRITA);
    expect(requisicoes).toHaveLength(1);
    requisicoes[0].flush(
      { type: 'about:blank', title: 'Recusado', status: 422, code: 'uniplus.validacao' },
      {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: { 'content-type': 'application/problem+json' },
      },
    );
  });
});
