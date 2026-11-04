import { describe, expect, it } from 'vitest';
import { renumerar } from '../../shared/descricao-da-fase';
import { trocaFechaCiclo, violacoesDePrecedencia } from './precedencia-de-fases';
import { fase, aresta } from './cronograma-do-certame.testing';

describe('precedência entre fases', () => {
  it('acusa a ordem invertida quando as duas fases estão no cronograma', () => {
    const violacoes = violacoesDePrecedencia(
      [
        fase({ codigo: 'HOMOLOGACAO', ordem: 1 }),
        fase({ codigo: 'INSCRICAO', ordem: 2, faseCanonicaId: 'id-2' }),
      ],
      [aresta({})],
    );

    expect(violacoes).toHaveLength(1);
    expect(violacoes[0].motivo).toBe('ordem');
  });

  /**
   * A ausência de uma das duas fases NÃO é violação — é o que permite um
   * cronograma curto, e o agregado é explícito quanto a isso.
   */
  it('ignora a aresta cuja outra ponta não está no cronograma', () => {
    const violacoes = violacoesDePrecedencia(
      [fase({ codigo: 'INSCRICAO', ordem: 1 })],
      [aresta({})],
    );

    expect(violacoes).toEqual([]);
  });

  it('acusa janelas sobrepostas quando a aresta não permite sobreposição', () => {
    const violacoes = violacoesDePrecedencia(
      [
        fase({ codigo: 'INSCRICAO', ordem: 1, fim: '2026-03-20T23:59:59-03:00' }),
        fase({
          codigo: 'HOMOLOGACAO',
          ordem: 2,
          faseCanonicaId: 'id-2',
          inicio: '2026-03-15T08:00:00-03:00',
        }),
      ],
      [aresta({ permiteSobreposicao: false })],
    );

    expect(violacoes).toHaveLength(1);
    expect(violacoes[0].motivo).toBe('sobreposicao');
  });

  it('aceita as mesmas janelas quando a aresta permite sobreposição', () => {
    const violacoes = violacoesDePrecedencia(
      [
        fase({ codigo: 'INSCRICAO', ordem: 1, fim: '2026-03-20T23:59:59-03:00' }),
        fase({
          codigo: 'HOMOLOGACAO',
          ordem: 2,
          faseCanonicaId: 'id-2',
          inicio: '2026-03-15T08:00:00-03:00',
        }),
      ],
      [aresta({ permiteSobreposicao: true })],
    );

    expect(violacoes).toEqual([]);
  });

  /**
   * O mesmo instante escrito em deslocamentos diferentes precisa comparar igual.
   * Comparar o texto separaria os dois, e a tela acusaria sobreposição onde não
   * há.
   */
  it('compara janelas pelo instante, não pelo texto', () => {
    const violacoes = violacoesDePrecedencia(
      [
        fase({ codigo: 'INSCRICAO', ordem: 1, fim: '2026-03-20T23:59:59-03:00' }),
        fase({
          codigo: 'HOMOLOGACAO',
          ordem: 2,
          faseCanonicaId: 'id-2',
          inicio: '2026-03-21T02:59:59Z',
        }),
      ],
      [aresta({ permiteSobreposicao: false })],
    );

    expect(violacoes).toEqual([]);
  });
});

describe('permutação de ordem', () => {
  const a = fase({ faseCanonicaId: 'a', codigo: 'INSCRICAO', ordem: 1 });
  const b = fase({ faseCanonicaId: 'b', codigo: 'HOMOLOGACAO', ordem: 2 });

  it('acusa a troca direta entre duas fases retidas', () => {
    const depois = [
      { ...a, ordem: 2 },
      { ...b, ordem: 1 },
    ];

    expect(trocaFechaCiclo([a, b], depois)).toBe(true);
  });

  /** Cadeia que termina em ordem livre não fecha ciclo. */
  it('aceita o deslocamento para uma ordem que ninguém ocupa', () => {
    const depois = [
      { ...a, ordem: 3 },
      { ...b, ordem: 2 },
    ];

    expect(trocaFechaCiclo([a, b], depois)).toBe(false);
  });

  /** A remoção libera o valor, então a cadeia que termina nela não é ciclo. */
  it('aceita assumir a ordem de uma fase removida', () => {
    const depois = [{ ...a, ordem: 2 }];

    expect(trocaFechaCiclo([a, b], depois)).toBe(false);
  });

  /**
   * Renumerar sequencialmente **não** evita o ciclo — trocar duas fases de
   * lugar e renumerar produz exatamente a permutação que o servidor recusa. É a
   * reordenação mais comum que existe, e quem implementar o arrastar-e-soltar
   * precisa guardá-la com `trocaFechaCiclo`, não confiar na renumeração.
   *
   * A saída é mover uma das fases para uma ordem livre numa gravação e fechar o
   * ciclo na seguinte, que é o que a recusa do domínio orienta.
   */
  it('renumerar após trocar duas fases produz o ciclo que o servidor recusa', () => {
    const depois = renumerar([b, a]);

    expect(depois.map((f) => f.ordem)).toEqual([1, 2]);
    expect(trocaFechaCiclo([a, b], depois)).toBe(true);
  });
});
