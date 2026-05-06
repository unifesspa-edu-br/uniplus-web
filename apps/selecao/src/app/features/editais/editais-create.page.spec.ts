import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiResultInterceptor } from '@uniplus/shared-core';
import { SELECAO_BASE_PATH } from '@uniplus/shared-data';
import { EditaisCreatePage } from './editais-create.page';

const BASE = 'http://localhost:5000';

const COMANDO_VALIDO = {
  numeroEdital: 42,
  anoEdital: 2026,
  titulo: 'PSE 2026',
  tipoProcesso: 1,
  maximoOpcoesCurso: 2,
};

describe('EditaisCreatePage', () => {
  let fixture: ComponentFixture<EditaisCreatePage>;
  let component: EditaisCreatePage;
  let controller: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [EditaisCreatePage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });

    fixture = TestBed.createComponent(EditaisCreatePage);
    component = fixture.componentInstance;
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  function preencherFormComValido(): void {
    component.form.setValue(COMANDO_VALIDO);
  }

  it('inicializa form vazio (titulo + maximoOpcoesCurso default 1) e gera idempotency key na 1ª render', () => {
    expect(component.form.value.titulo).toBe('');
    expect(component.form.value.maximoOpcoesCurso).toBe(1);
    expect(component.idempotencyKeyAtual()).toMatch(/^[0-9a-f-]{36}$/);
    expect(component.submitting()).toBe(false);
    expect(component.errorMessage()).toBeNull();
  });

  it('form invalid não dispara POST e marca controls como touched', () => {
    component['enviar']();

    controller.expectNone(`${BASE}/api/editais`);
    expect(component.form.controls.titulo.touched).toBe(true);
    expect(component.form.controls.numeroEdital.touched).toBe(true);
  });

  it('submit válido dispara POST com Idempotency-Key, navega para /editais e regenera key', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    preencherFormComValido();
    const keyOriginal = component.idempotencyKeyAtual();

    component['enviar']();

    expect(component.submitting()).toBe(true);

    const req = controller.expectOne(`${BASE}/api/editais`);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe(keyOriginal);
    expect(req.request.body).toEqual(COMANDO_VALIDO);
    req.flush('01960000-0000-7000-0000-000000000099', {
      status: 201,
      statusText: 'Created',
    });

    expect(component.submitting()).toBe(false);
    expect(navigateSpy).toHaveBeenCalledWith(['/editais']);
    expect(component.idempotencyKeyAtual()).not.toBe(keyOriginal);
    expect(component.idempotencyKeyAtual()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('submit com 422 mapeia errors[].field para FormControl.setErrors({ backend })', () => {
    preencherFormComValido();

    component['enviar']();

    controller.expectOne(`${BASE}/api/editais`).flush(
      {
        type: 'about:blank',
        title: 'Falha de validação',
        status: 422,
        code: 'uniplus.validation.falhou',
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        errors: [
          { field: 'titulo', code: 'NotEmpty', message: 'Título não pode ser vazio.' },
          { field: 'numeroEdital', code: 'GreaterThan', message: 'Número deve ser positivo.' },
        ],
      },
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'Content-Type': 'application/problem+json' } },
    );

    expect(component.submitting()).toBe(false);
    expect(component.errorMessage()).toBeNull();
    expect(component.form.controls.titulo.errors).toEqual({
      backend: { code: 'NotEmpty', message: 'Título não pode ser vazio.' },
    });
    expect(component.form.controls.numeroEdital.errors).toEqual({
      backend: { code: 'GreaterThan', message: 'Número deve ser positivo.' },
    });
    // Outros campos permanecem sem erro do backend.
    expect(component.form.controls.anoEdital.errors).toBeNull();
  });

  it('submit com 422 sem field reconhecido cai num banner geral (não silencia)', () => {
    preencherFormComValido();
    component['enviar']();

    controller.expectOne(`${BASE}/api/editais`).flush(
      {
        type: 'about:blank',
        title: 'Falha de validação',
        status: 422,
        code: 'uniplus.validation.falhou',
        traceId: 'tx',
        errors: [{ field: 'campo_inexistente', code: 'X', message: 'Y' }],
      },
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'Content-Type': 'application/problem+json' } },
    );

    expect(component.errorMessage()).toContain('Não foi possível mapear');
  });

  it('submit com 409 popula errorMessage banner via ProblemI18nService.title', () => {
    preencherFormComValido();
    component['enviar']();

    controller.expectOne(`${BASE}/api/editais`).flush(
      {
        type: 'about:blank',
        title: 'Edital já existente',
        status: 409,
        code: 'uniplus.selecao.edital.duplicado',
        traceId: 'tx2',
      },
      { status: 409, statusText: 'Conflict', headers: { 'Content-Type': 'application/problem+json' } },
    );

    expect(component.errorMessage()).toBe('Edital já existente');
    expect(component.submitting()).toBe(false);
  });

  it('após 422, corrigir campo limpa o erro backend e permite resubmissão com a mesma key (form-scoped end-to-end)', () => {
    preencherFormComValido();
    const keyOriginal = component.idempotencyKeyAtual();

    component['enviar']();
    controller.expectOne(`${BASE}/api/editais`).flush(
      {
        type: 'about:blank',
        title: 'Falha de validação',
        status: 422,
        code: 'uniplus.validation.falhou',
        traceId: 'tx',
        errors: [{ field: 'titulo', code: 'NotEmpty', message: 'Título é obrigatório.' }],
      },
      { status: 422, statusText: 'Unprocessable Entity', headers: { 'Content-Type': 'application/problem+json' } },
    );

    expect(component.form.controls.titulo.errors).toMatchObject({
      backend: { code: 'NotEmpty', message: 'Título é obrigatório.' },
    });
    expect(component.form.invalid).toBe(true);

    // Usuário corrige o campo — Angular re-executa validators e limpa o erro `backend`
    // (Angular sobrescreve setErrors manual no próximo valueChange).
    component.form.controls.titulo.setValue('PSE 2026 Corrigido');
    expect(component.form.controls.titulo.errors).toBeNull();
    expect(component.form.valid).toBe(true);

    // Segundo submit: form-scoped key preservada — backend reconhece como replay legítimo.
    component['enviar']();
    const reqRetry = controller.expectOne(`${BASE}/api/editais`);
    expect(reqRetry.request.headers.get('Idempotency-Key')).toBe(keyOriginal);
    reqRetry.flush('id-novo-pos-correcao', { status: 201, statusText: 'Created' });

    expect(component.idempotencyKeyAtual()).not.toBe(keyOriginal);
  });

  it('em falha, idempotency key é PRESERVADA — retry reusa a mesma key (form-scoped strategy)', () => {
    preencherFormComValido();
    const keyOriginal = component.idempotencyKeyAtual();

    component['enviar']();
    controller.expectOne(`${BASE}/api/editais`).flush(
      {
        type: 'about:blank',
        title: 'Edital já existente',
        status: 409,
        code: 'uniplus.selecao.edital.duplicado',
        traceId: 'tx',
      },
      { status: 409, statusText: 'Conflict', headers: { 'Content-Type': 'application/problem+json' } },
    );

    expect(component.idempotencyKeyAtual()).toBe(keyOriginal);

    // Retry: mesma key viaja de novo
    component['enviar']();
    const reqRetry = controller.expectOne(`${BASE}/api/editais`);
    expect(reqRetry.request.headers.get('Idempotency-Key')).toBe(keyOriginal);
    reqRetry.flush('id-novo', { status: 201, statusText: 'Created' });
  });

  it('botão submit fica disabled enquanto submitting()', () => {
    preencherFormComValido();
    component['enviar']();
    fixture.detectChanges();

    const botao = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(botao.disabled).toBe(true);

    controller.expectOne(`${BASE}/api/editais`).flush('id', { status: 201, statusText: 'Created' });
  });
});
