import { describe, expect, it } from 'vitest';
import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import { ordemSugeridaDasFases } from './ordem-sugerida-das-fases';

function fase(codigo: string): FaseCanonicaDto {
  return { id: `id-${codigo}`, codigo, nome: codigo } as FaseCanonicaDto;
}

function aresta(antecessora: string, sucessora: string): PrecedenciaFaseDto {
  return {
    id: `${antecessora}-${sucessora}`,
    antecessoraCodigo: antecessora,
    sucessoraCodigo: sucessora,
  } as PrecedenciaFaseDto;
}

describe('ordem sugerida das fases', () => {
  /**
   * O caso que um passe único de ajuste erra: com o catálogo em `B, C, A` e as
   * arestas nessa ordem, mover `B` para depois de `A` deixaria `C` antes de `B`,
   * violando `B→C`. A sugestão levaria o operador a uma ordem que o servidor
   * recusa.
   */
  it('respeita todas as arestas, qualquer que seja a ordem em que elas chegam', () => {
    const codigos = ordemSugeridaDasFases(
      [fase('B'), fase('C'), fase('A')],
      [aresta('B', 'C'), aresta('A', 'B')],
    ).map((f) => f.codigo);

    expect(codigos.indexOf('A')).toBeLessThan(codigos.indexOf('B'));
    expect(codigos.indexOf('B')).toBeLessThan(codigos.indexOf('C'));
  });

  it('mantém a ordem do catálogo entre fases que nenhuma aresta liga', () => {
    expect(
      ordemSugeridaDasFases([fase('X'), fase('Y'), fase('Z')], []).map((f) => f.codigo),
    ).toEqual(['X', 'Y', 'Z']);
  });

  /** Ciclo no cadastro não deveria existir, mas sumir com a fase é pior. */
  it('não perde fase quando o cadastro tem ciclo', () => {
    const ordenadas = ordemSugeridaDasFases(
      [fase('P'), fase('Q')],
      [aresta('P', 'Q'), aresta('Q', 'P')],
    );

    expect(ordenadas.map((f) => f.codigo).sort()).toEqual(['P', 'Q']);
  });
});
