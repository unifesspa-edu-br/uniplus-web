import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import { OpcaoDestacada } from './opcao-destacada';

describe('OpcaoDestacada', () => {
  it('mantém a navegação vazia e limpa os extremos de uma lista vazia', () => {
    const destaque = new OpcaoDestacada(signal<readonly string[]>([]));
    destaque.andar(1);
    expect(destaque.valor()).toBeNull();
    destaque.apontar('anterior');
    destaque.andar(-1);
    expect(destaque.valor()).toBe('anterior');
    destaque.irAoInicio();
    expect(destaque.valor()).toBeNull();
    destaque.apontar('anterior');
    destaque.irAoFim();
    expect(destaque.valor()).toBeNull();
  });

  it('começa pela primeira ou última opção quando não há destaque', () => {
    const destaque = new OpcaoDestacada(signal<readonly string[]>(['a', 'b', 'c']));
    destaque.andar(1);
    expect(destaque.valor()).toBe('a');
    destaque.limpar();
    destaque.andar(-1);
    expect(destaque.valor()).toBe('c');
  });

  it('volta ao início depois da última e navega aos extremos', () => {
    const destaque = new OpcaoDestacada(signal<readonly string[]>(['a', 'b', 'c']));
    destaque.irAoFim();
    expect(destaque.valor()).toBe('c');
    destaque.andar(1);
    expect(destaque.valor()).toBe('a');
    destaque.irAoFim();
    destaque.irAoInicio();
    expect(destaque.valor()).toBe('a');
  });
});
