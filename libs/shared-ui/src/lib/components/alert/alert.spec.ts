import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { AlertComponent } from './alert';

@Component({
  standalone: true,
  imports: [AlertComponent],
  template: `
    <ui-alert variant="danger" heading="Falhou" [dynamic]="dinamico">
      A mensagem.
      <button alertaAcoes type="button">Agir</button>
    </ui-alert>
  `,
})
class AnfitriaComponent {
  dinamico = true;
}

describe('AlertComponent', () => {
  function montar(dinamico = true): HTMLElement {
    const fixture = TestBed.createComponent(AnfitriaComponent);
    fixture.componentInstance.dinamico = dinamico;
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('a região viva cobre o título e a mensagem, com anúncio assertivo no perigo', () => {
    const regiao = montar().querySelector('[role="alert"]');

    expect(regiao?.textContent).toContain('Falhou');
    expect(regiao?.textContent).toContain('A mensagem.');
    expect(regiao?.getAttribute('aria-live')).toBe('assertive');
  });

  it('o conteúdo do slot de ações fica na caixa do alerta, fora da região viva', () => {
    const raiz = montar();
    const acao = raiz.querySelector('button') as HTMLElement;

    expect(acao.closest('.alert')).not.toBeNull();
    expect(acao.closest('[role="alert"]')).toBeNull();
  });

  it('sem a região dinâmica, o aviso não é uma região viva', () => {
    expect(montar(false).querySelector('[role="alert"]')).toBeNull();
  });
});
