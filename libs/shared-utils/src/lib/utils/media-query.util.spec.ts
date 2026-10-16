import { DestroyRef } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { mediaQuerySignal } from './media-query.util';

describe('mediaQuerySignal', () => {
  it('usa o valor inicial de matchMedia', () => {
    const removeEventListener = vi.fn();
    const addEventListener = vi.fn();

    window.matchMedia = vi.fn(
      () =>
        ({
          matches: true,
          addEventListener,
          removeEventListener,
        }) as unknown as MediaQueryList,
    );

    const resultado = mediaQuerySignal('(max-width: 600px)', {
      onDestroy: vi.fn(),
    } as unknown as DestroyRef);

    expect(resultado()).toBe(true);
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 600px)');
    expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('atualiza o signal quando a media query muda', () => {
    let ouvinte: ((evento: MediaQueryListEvent) => void) | undefined;

    const addEventListener = vi.fn(
      (_tipo: string, callback: (evento: MediaQueryListEvent) => void) => {
        ouvinte = callback;
      },
    );
    const removeEventListener = vi.fn();

    window.matchMedia = vi.fn(
      () =>
        ({
          matches: false,
          addEventListener,
          removeEventListener,
        }) as unknown as MediaQueryList,
    );

    const resultado = mediaQuerySignal('(max-width: 600px)', {
      onDestroy: vi.fn(),
    } as unknown as DestroyRef);

    expect(resultado()).toBe(false);

    ouvinte?.({ matches: true } as MediaQueryListEvent);

    expect(resultado()).toBe(true);

    ouvinte?.({ matches: false } as MediaQueryListEvent);

    expect(resultado()).toBe(false);
  });

  it('remove o listener quando o contexto é destruído', () => {
    let destruir: (() => void) | undefined;

    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();

    const destroyRef = {
      onDestroy(callback: () => void): () => void {
        destruir = callback;

        function cancelar(): void {
          // O mock não precisa cancelar o registro.
        }

        return cancelar;
      },
    } as unknown as DestroyRef;

    window.matchMedia = vi.fn(
      () =>
        ({
          matches: false,
          addEventListener,
          removeEventListener,
        }) as unknown as MediaQueryList,
    );

    mediaQuerySignal('(max-width: 600px)', destroyRef);

    const ouvinte = addEventListener.mock.calls[0]?.[1];

    destruir?.();

    expect(removeEventListener).toHaveBeenCalledWith('change', ouvinte);
  });

  it('retorna false quando matchMedia não está disponível', () => {
    const matchMediaOriginal = window.matchMedia;

    try {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: undefined,
      });

      const resultado = mediaQuerySignal('(max-width: 600px)', {
        onDestroy: vi.fn(),
      } as unknown as DestroyRef);

      expect(resultado()).toBe(false);
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: matchMediaOriginal,
      });
    }
  });
});
