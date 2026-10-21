import { DOCUMENT, Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { mediaQuerySignal } from './media-query';

function criarMediaQuery(matches: boolean) {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  const mediaQuery = {
    matches,
    addEventListener,
    removeEventListener,
  } as unknown as MediaQueryList;

  return { mediaQuery, addEventListener, removeEventListener };
}

function criarSinal(query: string, defaultView: Partial<Window> | null) {
  const injector = Injector.create({
    providers: [{ provide: DOCUMENT, useValue: { defaultView } }],
  }) as Injector & { destroy(): void };

  return {
    resultado: runInInjectionContext(injector, () => mediaQuerySignal(query)),
    destruir: () => injector.destroy(),
  };
}

describe('mediaQuerySignal', () => {
  it('usa o valor inicial de matchMedia do documento injetado', () => {
    const { mediaQuery, addEventListener } = criarMediaQuery(true);
    const matchMedia = vi.fn(() => mediaQuery);

    const { resultado } = criarSinal('(max-width: 600px)', { matchMedia });

    expect(resultado()).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 600px)');
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('atualiza o signal quando a media query muda', () => {
    const { mediaQuery, addEventListener } = criarMediaQuery(false);

    const { resultado } = criarSinal('(max-width: 600px)', { matchMedia: () => mediaQuery });
    const ouvinte = addEventListener.mock.calls[0]?.[1] as (evento: MediaQueryListEvent) => void;

    expect(resultado()).toBe(false);

    ouvinte({ matches: true } as MediaQueryListEvent);
    expect(resultado()).toBe(true);

    ouvinte({ matches: false } as MediaQueryListEvent);
    expect(resultado()).toBe(false);
  });

  it('remove o listener quando o contexto é destruído', () => {
    const { mediaQuery, addEventListener, removeEventListener } = criarMediaQuery(false);

    const { destruir } = criarSinal('(max-width: 600px)', { matchMedia: () => mediaQuery });
    const ouvinte = addEventListener.mock.calls[0]?.[1];

    destruir();

    expect(removeEventListener).toHaveBeenCalledWith('change', ouvinte);
  });

  it('retorna false quando matchMedia não está disponível', () => {
    expect(criarSinal('(max-width: 600px)', {}).resultado()).toBe(false);
    expect(criarSinal('(max-width: 600px)', null).resultado()).toBe(false);
  });
});
