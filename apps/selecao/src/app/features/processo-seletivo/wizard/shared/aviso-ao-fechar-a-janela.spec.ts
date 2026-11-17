import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { avisarAoFecharAJanelaEnquanto } from './aviso-ao-fechar-a-janela';

function fecharAJanela(): BeforeUnloadEvent {
  const evento = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  globalThis.dispatchEvent(evento);
  return evento;
}

describe('avisarAoFecharAJanelaEnquanto', () => {
  const pendente = signal(false);
  let pagina: EnvironmentInjector;
  let paginaAberta: boolean;

  beforeEach(() => {
    pendente.set(false);
    paginaAberta = true;
    pagina = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    runInInjectionContext(pagina, () => avisarAoFecharAJanelaEnquanto(pendente));
  });

  const fecharAPagina = (): void => {
    if (!paginaAberta) return;
    paginaAberta = false;
    pagina.destroy();
  };

  afterEach(fecharAPagina);

  it('não interfere ao fechar a janela quando não há ato digitado', () => {
    TestBed.tick();

    expect(fecharAJanela().defaultPrevented).toBe(false);
  });

  it('pede a confirmação do navegador enquanto há ato digitado', () => {
    pendente.set(true);
    TestBed.tick();

    expect(fecharAJanela().defaultPrevented).toBe(true);
  });

  it('deixa de pedir assim que o ato digitado some', () => {
    pendente.set(true);
    TestBed.tick();
    pendente.set(false);
    TestBed.tick();

    expect(fecharAJanela().defaultPrevented).toBe(false);
  });

  it('deixa de pedir quando a página é destruída', () => {
    pendente.set(true);
    TestBed.tick();
    fecharAPagina();

    expect(fecharAJanela().defaultPrevented).toBe(false);
  });
});
