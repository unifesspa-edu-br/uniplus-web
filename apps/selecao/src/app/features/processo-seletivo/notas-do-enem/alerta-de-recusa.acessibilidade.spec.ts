import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';

import { AlertaDeRecusaComponent } from './alerta-de-recusa.component';
import { explicarRecusa, type RecusaExplicada } from './recusas-do-enem';

@Component({
  standalone: true,
  imports: [AlertaDeRecusaComponent],
  template: `<sel-alerta-de-recusa [recusa]="recusa" />`,
})
class AnfitriaoComponent {
  recusa!: RecusaExplicada;
}

const RECUSA = explicarRecusa(
  {
    type: 'about:blank',
    title: 'Recusa',
    status: 413,
    code: 'uniplus.selecao.notas_do_enem.arquivo_grande_demais',
    traceId: '0af7651916cd43dd8448eb211c80319c',
  },
  'importacao',
);

function montar(): HTMLElement {
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: vi.fn() },
    configurable: true,
  });
  const fixture = TestBed.createComponent(AnfitriaoComponent);
  fixture.componentInstance.recusa = RECUSA;
  fixture.detectChanges();
  document.body.append(fixture.nativeElement);
  return fixture.nativeElement as HTMLElement;
}

describe('AlertaDeRecusaComponent: acessibilidade', () => {
  it('não tem violações com o bloco de referência ao suporte', async () => {
    const raiz = montar();

    const resultado = await axe.run(raiz, { rules: { region: { enabled: false } } });

    raiz.remove();
    expect(resultado.violations).toEqual([]);
  });

  it('o bloco fica fora do role="alert" e o botão Copiar tem nome acessível', () => {
    const raiz = montar();
    const botao = raiz.querySelector<HTMLButtonElement>('ui-referencia-ao-suporte button');

    expect(raiz.querySelector('[role="alert"] ui-referencia-ao-suporte')).toBeNull();
    expect(botao?.textContent?.trim()).toBe('Copiar');
    expect(botao?.getAttribute('aria-describedby')).not.toBeNull();
    raiz.remove();
  });

  it('o botão Copiar é um botão nativo, alcançável e acionável só pelo teclado', () => {
    const raiz = montar();
    const botao = raiz.querySelector<HTMLButtonElement>('ui-referencia-ao-suporte button');

    botao?.focus();

    expect(document.activeElement).toBe(botao);
    expect(botao?.tabIndex).toBeGreaterThanOrEqual(0);
    expect(botao?.type).toBe('button');
    raiz.remove();
  });
});
