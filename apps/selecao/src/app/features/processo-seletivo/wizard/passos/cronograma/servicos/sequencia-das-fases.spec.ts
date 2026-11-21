import { FormArray } from '@angular/forms';
import { describe, expect, it, vi } from 'vitest';

import { umaFaseDoCronograma } from '../../../shared/fase-do-cronograma.testing';
import { grupoDaFase } from '../cronograma-form';
import { SequenciaDasFases } from './sequencia-das-fases';

function fasesDoCronograma() {
  return new FormArray([
    grupoDaFase(umaFaseDoCronograma({ codigo: 'INSCRICAO', ordem: 1 })),
    grupoDaFase(umaFaseDoCronograma({ codigo: 'AVALIACAO', ordem: 2 })),
    grupoDaFase(umaFaseDoCronograma({ codigo: 'RESULTADO', ordem: 3 })),
  ]);
}

describe('Sequência das fases', () => {
  it('move a fase com seus controles e renumera as posições', () => {
    const fases = fasesDoCronograma();
    const primeira = fases.at(0);
    const sequencia = new SequenciaDasFases(fases);
    const alteracoes = vi.fn();
    fases.valueChanges.subscribe(alteracoes);

    sequencia.mover(0, 1);

    expect(fases.at(1)).toBe(primeira);
    expect(fases.controls.map((fase) => fase.controls.ordem.value)).toEqual([1, 2, 3]);
    expect(alteracoes).toHaveBeenCalledTimes(1);
  });

  it('não altera nem emite ao mover para fora do limite', () => {
    const fases = fasesDoCronograma();
    const controles = [...fases.controls];
    const alteracoes = vi.fn();
    fases.valueChanges.subscribe(alteracoes);

    new SequenciaDasFases(fases).mover(2, 1);

    expect(fases.controls).toEqual(controles);
    expect(alteracoes).not.toHaveBeenCalled();
  });

  it('retira a fase, renumera de 1 a N e emite uma única alteração', () => {
    const fases = fasesDoCronograma();
    const sequencia = new SequenciaDasFases(fases);
    const alteracoes = vi.fn();
    fases.valueChanges.subscribe(alteracoes);

    sequencia.retirar(0);

    expect(fases.controls.map((fase) => fase.controls.ordem.value)).toEqual([1, 2]);
    expect(alteracoes).toHaveBeenCalledTimes(1);
  });

  it('não faz nada ao retirar uma posição que não existe', () => {
    const fases = fasesDoCronograma();
    const sequencia = new SequenciaDasFases(fases);
    const alteracoes = vi.fn();
    fases.valueChanges.subscribe(alteracoes);

    sequencia.retirar(9);

    expect(fases.length).toBe(3);
    expect(alteracoes).not.toHaveBeenCalled();
  });

  it('desmarca a fase que sobe à primeira posição e não devolve a marca ao descer', () => {
    const fases = fasesDoCronograma();
    const sequencia = new SequenciaDasFases(fases);
    const marcada = fases.at(1);
    marcada.controls.noMesmoMomentoDaAnterior.setValue(true);
    sequencia.mover(1, -1);
    expect(marcada.controls.noMesmoMomentoDaAnterior.value).toBe(false);
    expect(sequencia.primeiraFaseDesmarcada()).toBe('AVALIACAO');
    sequencia.mover(0, 1);
    expect(marcada.controls.noMesmoMomentoDaAnterior.value).toBe(false);
    expect(sequencia.primeiraFaseDesmarcada()).toBeNull();
  });

  it('desmarca a nova primeira fase ao retirar a anterior', () => {
    const fases = fasesDoCronograma();
    const sequencia = new SequenciaDasFases(fases);
    fases.at(1).controls.noMesmoMomentoDaAnterior.setValue(true);
    sequencia.retirar(0);
    expect(fases.at(0).controls.noMesmoMomentoDaAnterior.value).toBe(false);
    expect(sequencia.primeiraFaseDesmarcada()).toBe('AVALIACAO');
  });

  it('mantém a marca ao mover entre outras posições e não avisa', () => {
    const fases = fasesDoCronograma();
    const sequencia = new SequenciaDasFases(fases);
    const marcada = fases.at(1);
    marcada.controls.noMesmoMomentoDaAnterior.setValue(true);
    sequencia.mover(1, 1);
    expect(marcada.controls.noMesmoMomentoDaAnterior.value).toBe(true);
    expect(sequencia.primeiraFaseDesmarcada()).toBeNull();
  });

  it('não desmarca a primeira fase que já chegou marcada quando outra fase se move ou sai', () => {
    const fases = fasesDoCronograma();
    const sequencia = new SequenciaDasFases(fases);
    const primeira = fases.at(0);
    primeira.controls.noMesmoMomentoDaAnterior.setValue(true);

    sequencia.mover(1, 1);
    sequencia.retirar(2);

    expect(primeira.controls.noMesmoMomentoDaAnterior.value).toBe(true);
    expect(sequencia.primeiraFaseDesmarcada()).toBeNull();
  });
});
