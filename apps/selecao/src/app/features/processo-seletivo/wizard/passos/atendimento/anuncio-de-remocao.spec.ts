import { Injector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { anunciarRemocao } from './anuncio-de-remocao';

describe('anunciarRemocao', () => {
  const remocao = { prefixoDoId: 'atend-cond-removida', indice: 0, tituloDaSecao: 'secao' };

  it('anuncia o nome sem depender do gênero', () => {
    const anuncio = signal('');
    anunciarRemocao(anuncio, TestBed.inject(Injector), {
      ...remocao,
      nome: 'Pessoa com deficiência',
    });
    expect(anuncio()).toBe('Removido da oferta: Pessoa com deficiência.');
  });

  it('anuncia o item sem nome', () => {
    const anuncio = signal('');
    anunciarRemocao(anuncio, TestBed.inject(Injector), { ...remocao, nome: undefined });
    expect(anuncio()).toBe('Item removido.');
  });
});
