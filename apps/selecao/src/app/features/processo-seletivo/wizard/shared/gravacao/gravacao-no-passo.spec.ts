import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { RESPOSTA_DESCARTADA, gravarNoPasso } from './gravacao-no-passo';

describe('gravarNoPasso', () => {
  let store: ProcessoSeletivoStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ProcessoSeletivoStore] });
    store = TestBed.inject(ProcessoSeletivoStore);
  });

  it('trava a edição enquanto o comando corre e devolve o resultado do corpo', async () => {
    let durante = false;

    const resposta = await gravarNoPasso(store, async () => {
      durante = store.salvando();
      return { ok: true };
    });

    expect(durante).toBe(true);
    expect(resposta).toEqual({ ok: true });
    expect(store.salvando()).toBe(false);
  });

  it('descarta a resposta de um processo que saiu de tela e não destrava o editor novo', async () => {
    const resposta = await gravarNoPasso(store, async () => {
      store.reset();
      store.salvando.set(true);
      return { ok: true };
    });

    expect(resposta).toBe(RESPOSTA_DESCARTADA);
    expect(store.salvando()).toBe(true);
  });

  it('destrava a edição quando o corpo falha', async () => {
    await expect(gravarNoPasso(store, () => Promise.reject(new Error('rede')))).rejects.toThrow(
      'rede',
    );

    expect(store.salvando()).toBe(false);
  });
});
