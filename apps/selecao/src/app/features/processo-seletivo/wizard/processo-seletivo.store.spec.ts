import { describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from './processo-seletivo.store';

describe('ProcessoSeletivoStore — ir para a fase do cronograma', () => {
  it('leva ao Cronograma e guarda a fase de destino', () => {
    const store = new ProcessoSeletivoStore();

    store.irParaFase('MATRICULA');

    expect(store.cronogramaVisivel()).toBe(true);
    expect(store.faseEmFoco()).toBe('MATRICULA');
  });

  it('não guarda a fase quando a navegação é recusada por gravação em curso', () => {
    const store = new ProcessoSeletivoStore();
    store.travamentoDeOrquestracao.set(true);

    store.irParaFase('MATRICULA');

    expect(store.cronogramaVisivel()).toBe(false);
    expect(store.faseEmFoco()).toBeNull();
  });
});
