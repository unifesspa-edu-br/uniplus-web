import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { avisoDeFalhaDoLookup } from './aviso-de-falha-do-lookup';

describe('avisoDeFalhaDoLookup', () => {
  function montar() {
    const comErro = signal(false);
    const pendente = signal(true);
    const aviso = TestBed.runInInjectionContext(() => avisoDeFalhaDoLookup({ comErro, pendente }));
    const assentar = (): void => TestBed.tick();
    return { comErro, pendente, aviso, assentar };
  }

  it('não aparece enquanto a primeira busca carrega', () => {
    const { aviso, assentar } = montar();
    assentar();

    expect(aviso()).toBe(false);
  });

  it('fica na tela durante a nova tentativa que segue a falha e sai quando ela dá certo', () => {
    const { comErro, pendente, aviso, assentar } = montar();
    comErro.set(true);
    pendente.set(false);
    assentar();
    expect(aviso()).toBe(true);

    comErro.set(false);
    pendente.set(true);
    assentar();
    expect(aviso()).toBe(true);

    pendente.set(false);
    assentar();
    expect(aviso()).toBe(false);
  });

  it('uma recarga sem falha anterior não mostra o aviso', () => {
    const { pendente, aviso, assentar } = montar();
    pendente.set(false);
    assentar();

    pendente.set(true);
    assentar();

    expect(aviso()).toBe(false);
  });
});
