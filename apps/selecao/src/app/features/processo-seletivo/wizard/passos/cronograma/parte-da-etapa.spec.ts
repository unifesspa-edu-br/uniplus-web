import { describe, expect, it } from 'vitest';

import { umaEtapaDoCronograma, umRecursoDaEtapa } from '../../shared/etapa-do-cronograma.testing';
import { localDaRecusa } from '../../shared/recusas/local-da-recusa';
import { conteudoDaParteDaEtapa, parteDaEtapa } from './parte-da-etapa';

const parteDe = (field: string) => {
  const local = localDaRecusa(field);
  if (local === null) throw new Error(`Sem lugar em ${field}.`);
  return parteDaEtapa(local);
};

describe('parteDaEtapa', () => {
  it('põe cada recurso numa parte só dele, pela posição', () => {
    expect(parteDe('etapas[0].recursos[2].prazoValor')).toEqual({ recurso: 2 });
  });

  it.each(['etapas[0].notaMaxima', 'etapas[0].bancas[0]', 'etapas[0]'])(
    'põe %s na parte da etapa',
    (field) => {
      expect(parteDe(field)).toBe('etapa');
    },
  );
});

describe('conteudoDaParteDaEtapa', () => {
  const etapa = umaEtapaDoCronograma({ ordem: 2, recursos: [umRecursoDaEtapa()] });

  it('não leva os recursos nem a posição à parte da etapa', () => {
    const parte = conteudoDaParteDaEtapa(etapa, 'etapa') as Record<string, unknown>;

    expect(parte).not.toHaveProperty('recursos');
    expect(parte).not.toHaveProperty('ordem');
    expect(parte).toHaveProperty('notaMaxima');
  });

  it('leva só o recurso à parte dele', () => {
    expect(conteudoDaParteDaEtapa(etapa, { recurso: 0 })).toEqual(umRecursoDaEtapa());
  });

  it('vale nulo para o recurso que não existe mais', () => {
    expect(conteudoDaParteDaEtapa(etapa, { recurso: 3 })).toBeNull();
  });
});
