import { type ComponentFixture, TestBed } from '@angular/core/testing';
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
  let fixture: ComponentFixture<NotificationHostComponent>;

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText: vi.fn() },
      configurable: true,
    });
    TestBed.configureTestingModule({ imports: [NotificationHostComponent] });
    TestBed.inject(NotificationService).errorFromProblem(PROBLEMA);
    fixture = TestBed.createComponent(NotificationHostComponent);
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

  it('não tem violações com o <details> aberto e 12 identificadores anteriores', async () => {
    const anteriores = Array.from({ length: 12 }, (_, i) => String(i).padStart(2, '0').repeat(16));
    for (const traceId of anteriores) {
      TestBed.inject(NotificationService).errorFromProblem({ ...PROBLEMA, traceId });
    }
    fixture.detectChanges();
    const detalhes = raiz.querySelector('details');
    expect(detalhes).not.toBeNull();
    expect(detalhes?.querySelectorAll('ui-referencia-ao-suporte')).toHaveLength(12);
    detalhes?.setAttribute('open', '');
    const resultado = await axe.run(raiz, { rules: { region: { enabled: false } } });
    expect(resultado.violations).toEqual([]);
  });

  it('deixa o papel de anúncio nas regiões do host, nunca no cartão', () => {
    expect(raiz.querySelector('ui-aviso [role="alert"], ui-aviso [aria-live]')).toBeNull();
    expect(raiz.querySelector('.sr-only[role="status"][aria-live="polite"]')).not.toBeNull();
    expect(raiz.querySelector('.sr-only[aria-live="assertive"]')).not.toBeNull();
  });

  it('deixa o botão Copiar alcançável só pelo teclado, sem tabindex negativo', () => {
    const copiar = raiz.querySelector<HTMLButtonElement>('.referencia-ao-suporte button');
    expect(copiar?.tabIndex).toBe(0);
    expect(copiar?.disabled).toBe(false);
    expect(copiar?.getAttribute('aria-describedby')).not.toBeNull();
  });
});
