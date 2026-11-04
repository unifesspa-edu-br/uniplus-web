import { describe, expect, it } from 'vitest';

import type { CriterioDesempateConfigurado } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import {
  conferirDesempateGravado,
  reavaliarRecusaPeloDesempate,
} from './conferencia-do-desempate-gravado';
import {
  ESCOLHIDA,
  grupos,
  classificacao,
  lido,
  CARREGANDO,
  criterio,
} from './quadro-do-desempate.testing';

describe('conferirDesempateGravado', () => {
  it('sem critério por área não há o que conferir', () => {
    expect(
      conferirDesempateGravado(
        [{ ...criterio([]), regraCodigo: 'DESEMPATE-MAIOR-IDADE' }],
        classificacao(null),
        CARREGANDO,
      ),
    ).toEqual({ resultado: 'sem-pendencia' });
  });

  it('com o rascunho fora do ENEM, todo critério por área fica sem quadro', () => {
    expect(
      conferirDesempateGravado([criterio(['REDACAO'])], classificacao(null), CARREGANDO),
    ).toEqual({
      resultado: 'com-pendencias',
      pendencias: [{ posicao: 1, semQuadro: true, fora: [], todas: true }],
    });
  });

  it('aponta, pelo rótulo, as áreas que o cadastro lido não tem em todos os grupos', () => {
    expect(
      conferirDesempateGravado(
        [criterio(['REDACAO']), criterio(['LINGUAGENS', 'MATEMATICA'])],
        classificacao(ESCOLHIDA),
        lido(grupos('REDACAO', 'MATEMATICA')),
      ),
    ).toEqual({
      resultado: 'com-pendencias',
      pendencias: [{ posicao: 2, semQuadro: false, fora: ['Linguagens'], todas: false }],
    });
  });

  it('sem o cadastro lido não confere, o que não é o mesmo que não haver pendência', () => {
    expect(
      conferirDesempateGravado([criterio(['REDACAO'])], classificacao(ESCOLHIDA), CARREGANDO),
    ).toEqual({ resultado: 'nao-conferivel' });
  });
});

describe('reavaliarRecusaPeloDesempate', () => {
  function comRecusa(criterios: CriterioDesempateConfigurado[], leituraNaRecusa = 1) {
    const store = new ProcessoSeletivoStore();
    store.patchObjectSection('classificacao', classificacao(ESCOLHIDA));
    store.classificacao.criteriosDesempateGravados.set(criterios);
    store.classificacao.recusarPeloDesempate('Recusa pelo desempate.', leituraNaRecusa);
    return store;
  }

  it('com o cadastro relido depois da recusa, tira a recusa que ele já não provoca', () => {
    const store = comRecusa([criterio(['REDACAO'])]);

    reavaliarRecusaPeloDesempate(store, lido(grupos('REDACAO'), 2));

    expect(store.classificacao.recusaPeloDesempatePorArea()).toBeNull();
  });

  it('com o cadastro de antes da recusa, mantém a recusa: o servidor julgou pelo dele', () => {
    const store = comRecusa([criterio(['REDACAO'])]);

    reavaliarRecusaPeloDesempate(store, lido(grupos('REDACAO'), 1));

    expect(store.classificacao.recusaPeloDesempatePorArea()).toBe('Recusa pelo desempate.');
  });

  it('com o cadastro relido que ainda a provoca, mantém a recusa', () => {
    const store = comRecusa([criterio(['LINGUAGENS'])]);

    reavaliarRecusaPeloDesempate(store, lido(grupos('REDACAO'), 2));

    expect(store.classificacao.recusaPeloDesempatePorArea()).toBe('Recusa pelo desempate.');
  });

  it('sem critério por área gravado, tira a recusa sem depender do cadastro', () => {
    const store = comRecusa([{ ...criterio([]), regraCodigo: 'DESEMPATE-MAIOR-IDADE' }]);

    reavaliarRecusaPeloDesempate(store, CARREGANDO);

    expect(store.classificacao.recusaPeloDesempatePorArea()).toBeNull();
  });

  it('critérios regravados depois da recusa, com o mesmo cadastro, tiram a recusa que já não provocam', () => {
    const store = comRecusa([criterio(['LINGUAGENS'])]);
    store.classificacao.criteriosDesempateGravados.set([criterio(['REDACAO'])]);

    reavaliarRecusaPeloDesempate(store, lido(grupos('REDACAO'), 1));

    expect(store.classificacao.recusaPeloDesempatePorArea()).toBeNull();
  });

  it('os mesmos critérios regravados com o mesmo cadastro deixam a recusa', () => {
    const store = comRecusa([criterio(['REDACAO'])]);
    store.classificacao.criteriosDesempateGravados.set([criterio(['REDACAO'])]);

    reavaliarRecusaPeloDesempate(store, lido(grupos('REDACAO'), 1));

    expect(store.classificacao.recusaPeloDesempatePorArea()).toBe('Recusa pelo desempate.');
  });

  it('com os critérios gravados desconhecidos, mantém a recusa', () => {
    const store = comRecusa([criterio(['REDACAO'])]);
    store.classificacao.criteriosDesempateGravados.set(null);

    reavaliarRecusaPeloDesempate(store, lido(grupos('REDACAO'), 2));

    expect(store.classificacao.recusaPeloDesempatePorArea()).toBe('Recusa pelo desempate.');
  });
});
