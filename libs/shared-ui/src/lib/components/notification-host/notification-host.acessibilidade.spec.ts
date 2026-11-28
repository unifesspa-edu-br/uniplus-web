import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';

import { NotificationHostComponent } from './notification-host';

const PROBLEMA: ProblemDetails = {
  type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/exemplo',
  title: 'Não foi possível gravar',
  status: 422,
  detail: 'Confira os dados informados.',
  code: 'uniplus.selecao.exemplo',
  traceId: '0af7651916cd43dd8448eb211c80319c',
};

describe('NotificationHostComponent: acessibilidade', () => {
  let raiz: HTMLElement;

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: vi.fn() },
      configurable: true,
    });
    TestBed.configureTestingModule({ imports: [NotificationHostComponent] });
    TestBed.inject(NotificationService).errorFromProblem(PROBLEMA);
    const fixture = TestBed.createComponent(NotificationHostComponent);
    fixture.detectChanges();
    raiz = fixture.nativeElement;
    document.body.append(raiz);
  });

  afterEach(() => {
    raiz.remove();
    TestBed.resetTestingModule();
  });

  it('não tem violações com o aviso de erro e o bloco de referência', async () => {
    const resultado = await axe.run(raiz, { rules: { region: { enabled: false } } });
    expect(resultado.violations).toEqual([]);
  });

  it('mantém o bloco fora do elemento role="alert"', () => {
    const alerta = raiz.querySelector('[role="alert"]');
    expect(alerta?.querySelector('.referencia-ao-suporte')).toBeNull();
    expect(raiz.querySelector('article .referencia-ao-suporte')).not.toBeNull();
  });

  it('deixa o botão Copiar alcançável só pelo teclado, sem tabindex negativo', () => {
    const copiar = raiz.querySelector<HTMLButtonElement>('.referencia-ao-suporte button');
    expect(copiar?.tabIndex).toBe(0);
    expect(copiar?.disabled).toBe(false);
    expect(copiar?.getAttribute('aria-describedby')).not.toBeNull();
  });
});
