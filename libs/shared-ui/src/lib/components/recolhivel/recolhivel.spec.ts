import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { RecolhivelComponent } from './recolhivel';

@Component({
  standalone: true,
  imports: [RecolhivelComponent],
  template: `<ui-recolhivel titulo="Definição"><p>Conteúdo</p></ui-recolhivel>`,
})
class HospedeiroDeTeste {}

describe('RecolhivelComponent', () => {
  it('chega recolhido, abre e fecha pelo título e anuncia o estado', () => {
    const fixture = TestBed.createComponent(HospedeiroDeTeste);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const titulo = raiz.querySelector('button') as HTMLButtonElement;
    const corpo = raiz.querySelector(`#${titulo.getAttribute('aria-controls')}`) as HTMLElement;

    expect(titulo.textContent).toContain('Definição');
    expect(titulo.getAttribute('aria-expanded')).toBe('false');
    expect(corpo.hidden).toBe(true);

    titulo.click();
    fixture.detectChanges();
    expect(titulo.getAttribute('aria-expanded')).toBe('true');
    expect(corpo.hidden).toBe(false);
    expect(corpo.textContent).toContain('Conteúdo');

    titulo.click();
    fixture.detectChanges();
    expect(corpo.hidden).toBe(true);
  });
});
