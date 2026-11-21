import { describe, expect, it } from 'vitest';

import type { FaseDoCronograma } from '../../processo-seletivo.models';
import { localDaRecusa } from '../../shared/recusas/local-da-recusa';
import { umaFaseDoCronograma } from '../../shared/fase-do-cronograma.testing';
import { conteudoDaParte, parteDaFase } from './parte-da-fase';

const parteDe = (field: string) => {
  const local = localDaRecusa(field);
  if (local === null) throw new Error(`Sem lugar em ${field}.`);
  return parteDaFase(local);
};

describe('parteDaFase', () => {
  it('põe a regra de recurso numa parte só dela', () => {
    expect(parteDe('fases[0].regraRecurso.prazoValor')).toBe('regraDeRecurso');
  });

  it.each(['fases[0].fim', 'fases[0].produtos[0]', 'fases[0]', 'fases[0].bancas[x]'])(
    'põe %s na parte da fase',
    (field) => {
      expect(parteDe(field)).toBe('fase');
    },
  );
});

describe('conteudoDaParte', () => {
  const fase: FaseDoCronograma = umaFaseDoCronograma({ ordem: 2 });

  it('não leva a regra de recurso nem a posição à parte da fase', () => {
    const parte = conteudoDaParte(fase, 'fase') as Record<string, unknown>;

    expect(parte).not.toHaveProperty('regraRecurso');
    expect(parte).not.toHaveProperty('ordem');
    expect(parte).toHaveProperty('produtos');
  });

  it('leva só a regra de recurso à parte dela', () => {
    expect(conteudoDaParte({ ...fase, regraRecurso: null }, 'regraDeRecurso')).toBeNull();
  });
});
