import { Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { aguardarRecarga } from './aguardar-recarga';

describe('aguardarRecarga', () => {
  function montar() {
    const carregando = signal(false);
    const comFalha = signal(false);
    const espera = runInInjectionContext(TestBed.inject(Injector), () =>
      aguardarRecarga(carregando, comFalha),
    );
    const assentar = () => TestBed.tick();
    return { carregando, comFalha, espera, assentar };
  }

  it('aguarda do pedido até a leitura terminar', () => {
    const { carregando, espera, assentar } = montar();
    expect(espera.aguardando()).toBe(false);

    espera.iniciar();
    assentar();
    expect(espera.aguardando()).toBe(true);

    carregando.set(true);
    assentar();
    expect(espera.aguardando()).toBe(true);

    carregando.set(false);
    assentar();
    expect(espera.aguardando()).toBe(false);
  });

  it('uma leitura que falha sem chegar a carregar também encerra a espera', () => {
    const { comFalha, espera, assentar } = montar();
    comFalha.set(true);
    espera.iniciar();
    assentar();
    expect(espera.aguardando()).toBe(false);
  });

  it('antes de a leitura começar, a espera não termina', () => {
    const { espera, assentar } = montar();
    espera.iniciar();
    assentar();
    assentar();
    expect(espera.aguardando()).toBe(true);
  });

  it('uma segunda escrita volta a esperar a leitura seguinte, sem herdar a anterior', () => {
    const { carregando, espera, assentar } = montar();
    espera.iniciar();
    assentar();
    carregando.set(true);
    assentar();
    carregando.set(false);
    assentar();
    expect(espera.aguardando()).toBe(false);

    espera.iniciar();
    assentar();
    assentar();
    expect(espera.aguardando()).toBe(true);

    carregando.set(true);
    assentar();
    carregando.set(false);
    assentar();
    expect(espera.aguardando()).toBe(false);
  });
});
