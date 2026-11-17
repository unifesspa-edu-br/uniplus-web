import { StatusProcesso, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
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

describe('ProcessoSeletivoStore — progresso', () => {
  it('substitui o conjunto de concluídos em syncCompleted', () => {
    const store = new ProcessoSeletivoStore();

    store.syncCompleted([0, 3]);
    expect([...store.passosConcluidos()]).toEqual([0, 3]);

    store.syncCompleted([1]);
    expect([...store.passosConcluidos()]).toEqual([1]);
  });
});

describe('ProcessoSeletivoStore — processo fora de rascunho', () => {
  const comStatus = (status: StatusProcesso) => ({ id: 'p1', status }) as ProcessoSeletivoDto;

  it('sem detalhe lido, o processo não está fora de rascunho e a edição segue permitida', () => {
    const store = new ProcessoSeletivoStore();

    expect(store.processoForaDeRascunho()).toBe(false);
    expect(store.edicaoPermitida()).toBe(true);
  });

  it('o status publicado confirma o processo fora de rascunho e encerra a edição', () => {
    const store = new ProcessoSeletivoStore();

    store.remoteSnapshot.set(comStatus(StatusProcesso.publicado));

    expect(store.processoForaDeRascunho()).toBe(true);
    expect(store.edicaoPermitida()).toBe(false);
  });

  it('a publicação não confirmada bloqueia a edição sem dizer que o processo saiu do rascunho', () => {
    const store = new ProcessoSeletivoStore();
    store.remoteSnapshot.set(comStatus(StatusProcesso.rascunho));

    store.publicacaoNaoConfirmada.set(true);

    expect(store.edicaoPermitida()).toBe(false);
    expect(store.processoForaDeRascunho()).toBe(false);
  });
});
