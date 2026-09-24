import { ApplicationRef, afterNextRender, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { focarAposNovaTentativa, type NovaTentativa } from './focar-apos-nova-tentativa';

describe('focarAposNovaTentativa', () => {
  // O pendente chega ao utilitário como `computed`, como numa página que combina sinais:
  // um `computed` que termina onde começou não avisa o efeito de que mudou.
  const carregando = signal(false);
  const pendente = computed(() => carregando());
  const falhou = signal(true);
  let botao: HTMLButtonElement;
  let destino: HTMLHeadingElement;
  let tentativa: NovaTentativa;
  let appRef: ApplicationRef;

  beforeEach(() => {
    carregando.set(false);
    falhou.set(true);
    botao = document.createElement('button');
    destino = document.createElement('h1');
    destino.tabIndex = -1;
    document.body.append(botao, destino);
    appRef = TestBed.inject(ApplicationRef);
    tentativa = TestBed.runInInjectionContext(() =>
      focarAposNovaTentativa(pendente, falhou, () => destino),
    );
    appRef.tick();
  });

  afterEach(() => {
    botao.remove();
    destino.remove();
  });

  /** Simula a renderização que tira o alerta: o botão sai da tela antes do foco ser
   *  conferido, como acontece com o template da página. */
  function renderizarRemovendoOBotao(): void {
    afterNextRender({ earlyRead: () => botao.remove() }, { injector: TestBed.inject(ApplicationRef).injector });
    appRef.tick();
  }

  it('tentativa que termina bem com o foco no botão leva o foco ao destino', () => {
    botao.focus();
    tentativa.executar(() => carregando.set(true));
    appRef.tick();

    falhou.set(false);
    carregando.set(false);
    renderizarRemovendoOBotao();

    expect(document.activeElement).toBe(destino);
  });

  it('tentativa que termina de forma síncrona libera o acionamento: recarga posterior não move o foco', () => {
    botao.focus();
    // O erro síncrono encerra a tentativa dentro de `disparar`: pendente vai e volta, e a
    // falha continua, sem mudança que o efeito possa ver.
    tentativa.executar(() => {
      carregando.set(true);
      carregando.set(false);
    });
    appRef.tick();
    expect(document.activeElement).toBe(botao);

    // Uma recarga que ninguém pediu por este botão dá certo com ele ainda focado.
    carregando.set(true);
    appRef.tick();
    falhou.set(false);
    carregando.set(false);
    renderizarRemovendoOBotao();

    expect(document.activeElement).toBe(document.body);
  });

  it('clique repetido enquanto a lista carrega não dispara de novo', () => {
    let disparos = 0;
    tentativa.executar(() => {
      disparos += 1;
      carregando.set(true);
    });
    tentativa.executar(() => {
      disparos += 1;
    });
    expect(disparos).toBe(1);
  });
});
