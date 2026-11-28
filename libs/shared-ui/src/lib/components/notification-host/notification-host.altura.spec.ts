import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type HostMontado, achar, montarHost } from './notification-host.testing';

const ALTURA_DA_TELA = 800;

describe('NotificationHostComponent: altura dos avisos à vista', () => {
  let host: HostMontado;
  let avisarMudanca: () => void;
  const alturas = new Map<string, number>();

  beforeEach(() => {
    alturas.clear();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(chamada: () => void) {
          avisarMudanca = chamada;
        }
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(ALTURA_DA_TELA);
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.classList.contains('toast-region')) {
        return [...this.querySelectorAll('ui-aviso')].reduce((s, c) => s + medida(c), 0);
      }
      return medida(this);
    });
    host = montarHost(false);
  });

  afterEach(() => {
    host.raiz.remove();
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const medida = (el: Element): number => alturas.get(el.getAttribute('data-aviso-id') ?? '') ?? 0;
  const aVista = (): number => host.raiz.querySelectorAll('.toast-region ui-aviso').length;

  function incluir(altura: number): number {
    const id = host.service.info(`Aviso ${alturas.size + 1}`, undefined, { persistent: true });
    alturas.set(String(id), altura);
    return id;
  }

  function medirAteEstabilizar(): void {
    for (let i = 0; i < 5; i++) {
      host.fixture.detectChanges();
      avisarMudanca();
    }
    host.fixture.detectChanges();
  }

  it('reduz de 3 para 2 e para 1 enquanto passar de 50% da tela', () => {
    incluir(100);
    incluir(300);
    incluir(300);
    host.fixture.detectChanges();
    expect(aVista()).toBe(3);
    avisarMudanca();
    host.fixture.detectChanges();
    expect(aVista()).toBe(2);
    avisarMudanca();
    host.fixture.detectChanges();
    expect(aVista()).toBe(1);
    expect(achar(host.raiz, '.toast-mais').textContent?.trim()).toBe('Mais 2 avisos');
  });

  it('nunca deixa menos de 1 aviso à vista, mesmo mais alto que a metade da tela', () => {
    incluir(700);
    host.fixture.detectChanges();
    medirAteEstabilizar();
    expect(aVista()).toBe(1);
  });

  it('volta a mostrar mais avisos quando sobra espaço ao fechar', () => {
    incluir(100);
    incluir(300);
    const maisNovo = incluir(300);
    host.fixture.detectChanges();
    medirAteEstabilizar();
    expect(aVista()).toBe(1);
    host.service.dismiss(maisNovo);
    medirAteEstabilizar();
    expect(aVista()).toBe(2);
  });

  it('não oscila quando o recolhido não cabe', () => {
    incluir(300);
    incluir(300);
    host.fixture.detectChanges();
    medirAteEstabilizar();
    expect(aVista()).toBe(1);
    medirAteEstabilizar();
    expect(aVista()).toBe(1);
  });

  it('não mede sem ResizeObserver', () => {
    TestBed.resetTestingModule();
    host.raiz.remove();
    vi.unstubAllGlobals();
    host = montarHost(false);
    incluir(700);
    incluir(700);
    host.fixture.detectChanges();
    expect(aVista()).toBe(2);
  });
});
