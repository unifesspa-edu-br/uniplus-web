import { describe, expect, it } from 'vitest';

import { NumeracaoDasRespostasRecusadas } from './numeracao-das-respostas-recusadas';

describe('NumeracaoDasRespostasRecusadas', () => {
  it('numera as respostas na ordem em que chegam, a partir de 1', () => {
    const numeracao = new NumeracaoDasRespostasRecusadas();

    expect([numeracao.proxima(), numeracao.proxima(), numeracao.proxima()]).toEqual([1, 2, 3]);
  });

  it('não divide a contagem entre páginas diferentes', () => {
    const daPrimeira = new NumeracaoDasRespostasRecusadas();
    const daSegunda = new NumeracaoDasRespostasRecusadas();
    daPrimeira.proxima();
    daPrimeira.proxima();

    expect(daSegunda.proxima()).toBe(1);
  });
});
