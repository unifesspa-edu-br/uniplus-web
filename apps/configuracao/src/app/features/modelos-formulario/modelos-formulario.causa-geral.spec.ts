import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { CONFIGURACAO_BASE_PATH } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModelosFormularioPage } from './modelos-formulario.page';
import { modelo } from './modelos-formulario.escritas.testing';

const BASE = 'http://localhost:5000';
const URL = `${BASE}/api/configuracao/admin/modelos-formulario`;
const PROBLEMA = { 'content-type': 'application/problem+json' };
const CAUSA_GERAL = { code: 'uniplus.configuracao.bloqueado', message: 'O modelo está bloqueado.' };

function recusa(status: number, code: string): [string, object] {
  const corpo = JSON.stringify({
    type: 'about:blank',
    title: 'Falha',
    status,
    code,
    errors: [CAUSA_GERAL],
  });
  return [corpo, { status, statusText: 'Erro', headers: PROBLEMA }];
}

describe('ModelosFormularioPage — causa geral na recusa da criação', () => {
  let fixture: ComponentFixture<ModelosFormularioPage>;
  let controller: HttpTestingController;
  let appRef: ApplicationRef;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [ModelosFormularioPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: PermissoesService, useValue: { tem: () => true } },
        { provide: CONFIGURACAO_BASE_PATH, useValue: BASE },
      ],
    });
    fixture = TestBed.createComponent(ModelosFormularioPage);
    controller = TestBed.inject(HttpTestingController);
    appRef = TestBed.inject(ApplicationRef);
    fixture.detectChanges();
    controller.expectOne((r) => r.url === URL).flush([modelo]);
    controller.expectOne((r) => r.url === `${BASE}/api/configuracao/tipos-processo`).flush([]);
    await propagar();
  });
  afterEach(() => controller.verify());

  async function propagar(): Promise<void> {
    await Promise.resolve();
    appRef.tick();
    fixture.detectChanges();
  }

  function elemento<T extends HTMLElement>(seletor: string): T {
    const el = (fixture.nativeElement as HTMLElement).querySelector<T>(seletor);
    expect(el, seletor).not.toBeNull();
    return el as T;
  }

  async function enviarERecusar(status: number, code: string): Promise<void> {
    elemento<HTMLButtonElement>('.panel-head .btn--primary').click();
    await propagar();
    const nome = elemento<HTMLInputElement>('input[formcontrolname="nome"]');
    nome.value = 'Inscrição';
    nome.dispatchEvent(new Event('input'));
    elemento<HTMLFormElement>('#cfg-modelo-criacao').dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    await propagar();
    controller.expectOne(URL).flush(...recusa(status, code));
    await propagar();
  }

  it('o código repetido marca o campo do código e mostra a causa geral no alerta', async () => {
    await enviarERecusar(409, 'uniplus.configuracao.modelo_formulario.codigo_ja_existe');

    const codigo = elemento<HTMLInputElement>('input[formcontrolname="codigo"]');
    expect(codigo.getAttribute('aria-invalid')).toBe('true');
    expect(elemento('ui-alert[variant="danger"]').textContent).toContain(
      'O modelo está bloqueado.',
    );
  });

  it('a recusa só de causa geral mostra a causa no lugar do título, sem marcar campo', async () => {
    await enviarERecusar(422, 'uniplus.validacao');

    expect(elemento('ui-alert[variant="danger"]').textContent).toContain(
      'O modelo está bloqueado.',
    );
    expect(document.querySelector('[aria-invalid="true"]')).toBeNull();
  });
});
