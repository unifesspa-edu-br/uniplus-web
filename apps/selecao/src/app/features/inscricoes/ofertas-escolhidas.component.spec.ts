import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { OfertaExibida } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { OfertasEscolhidasComponent } from './ofertas-escolhidas.component';

const oferta = (ordem: number, nome: string): OfertaExibida => ({ id: `o${ordem}`, nome, ordem });

function criar(ofertas: readonly OfertaExibida[]): HTMLElement {
  const fixture: ComponentFixture<OfertasEscolhidasComponent> = TestBed.createComponent(
    OfertasEscolhidasComponent,
  );
  fixture.componentRef.setInput('ofertas', ofertas);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('OfertasEscolhidasComponent', () => {
  it('com uma oferta mostra só o nome, sem lista', () => {
    const host = criar([oferta(1, 'Medicina')]);

    expect(host.textContent?.trim()).toBe('Medicina');
    expect(host.querySelector('ol')).toBeNull();
  });

  it('com duas ou mais numera pela ordem da escolha', () => {
    const host = criar([oferta(1, 'Medicina'), oferta(3, 'Direito')]);

    const itens = Array.from(host.querySelectorAll('li')).map((li) => [li.value, li.textContent]);
    expect(itens).toEqual([
      [1, 'Medicina'],
      [3, 'Direito'],
    ]);
  });

  it('sem ofertas não mostra nada', () => {
    expect(criar([]).textContent?.trim()).toBe('');
  });
});
