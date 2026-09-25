import { describe, expect, it } from 'vitest';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RolagemFocavelDirective } from './rolagem-focavel.directive';

@Component({
  standalone: true,
  imports: [RolagemFocavelDirective],
  template: `
    <p id="legenda">Matriz de destinos</p>
    <div class="caixa" uiRolagemFocavel="legenda"><table></table></div>
  `,
})
class HospedeiroComponent {}

/** jsdom não faz layout: as medidas da caixa são instaladas pelo teste. */
function definirMedidas(
  elemento: HTMLElement,
  medidas: { scrollWidth: number; clientWidth: number; scrollHeight: number; clientHeight: number },
): void {
  for (const [propriedade, valor] of Object.entries(medidas)) {
    Object.defineProperty(elemento, propriedade, { configurable: true, get: () => valor });
  }
}

async function montar() {
  const fixture = TestBed.createComponent(HospedeiroComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const caixa = fixture.nativeElement.querySelector('.caixa') as HTMLElement;
  const remedir = async (): Promise<void> => {
    window.dispatchEvent(new Event('resize'));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { caixa, remedir };
}

describe('RolagemFocavelDirective', () => {
  it('não põe parada de tabulação numa caixa que cabe inteira', async () => {
    const { caixa } = await montar();

    expect(caixa.hasAttribute('tabindex')).toBe(false);
    expect(caixa.hasAttribute('role')).toBe(false);
    expect(caixa.hasAttribute('aria-labelledby')).toBe(false);
  });

  it('torna focável e nomeada a caixa que rola na horizontal', async () => {
    const { caixa, remedir } = await montar();

    definirMedidas(caixa, { scrollWidth: 600, clientWidth: 400, scrollHeight: 0, clientHeight: 0 });
    await remedir();

    expect(caixa.getAttribute('tabindex')).toBe('0');
    expect(caixa.getAttribute('role')).toBe('region');
    expect(caixa.getAttribute('aria-labelledby')).toBe('legenda');
  });

  it('torna focável a caixa que rola na vertical', async () => {
    const { caixa, remedir } = await montar();

    definirMedidas(caixa, { scrollWidth: 0, clientWidth: 0, scrollHeight: 500, clientHeight: 256 });
    await remedir();

    expect(caixa.getAttribute('tabindex')).toBe('0');
  });

  it('tira a parada de tabulação quando a caixa volta a caber', async () => {
    const { caixa, remedir } = await montar();
    definirMedidas(caixa, { scrollWidth: 600, clientWidth: 400, scrollHeight: 0, clientHeight: 0 });
    await remedir();

    definirMedidas(caixa, { scrollWidth: 400, clientWidth: 400, scrollHeight: 0, clientHeight: 0 });
    await remedir();

    expect(caixa.hasAttribute('tabindex')).toBe(false);
    expect(caixa.hasAttribute('role')).toBe(false);
  });
});
