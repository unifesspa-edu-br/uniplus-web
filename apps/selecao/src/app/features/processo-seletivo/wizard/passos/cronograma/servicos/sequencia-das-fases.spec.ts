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
});
