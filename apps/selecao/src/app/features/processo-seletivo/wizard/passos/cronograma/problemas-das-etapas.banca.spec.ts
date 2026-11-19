import { describe, expect, it } from 'vitest';

import type { EtapaPontuada } from '../../processo-seletivo.models';
import { COLEGIADA } from '../../shared/deliberacao/regra-de-deliberacao.testing';
import {
  catalogoDeFases,
  etapa,
  etapaValida,
  faseDeAvaliacao,
  problemasDe,
} from './cronograma-do-certame.testing';

describe('regra de deliberação das bancas da etapa', () => {
  function problemasDaRegra(
    regraDeDeliberacao: EtapaPontuada['bancas'][number]['regraDeDeliberacao'],
  ) {
    return problemasDe(
      [faseDeAvaliacao],
      [
        etapa({
          ...etapaValida,
          nome: 'Entrevista',
          bancas: [{ tipoBancaId: 'banca-1', regraDeDeliberacao }],
        }),
      ],
      catalogoDeFases,
      [],
    ).filter((problema) => problema.includes('regra de deliberação'));
  }

  it('não cobra a banca sem regra: ela só é exigida na publicação', () => {
    expect(problemasDaRegra(null)).toEqual([]);
  });

  it('não cobra a regra completa', () => {
    expect(problemasDaRegra(COLEGIADA)).toEqual([]);
  });

  it('cobra a regra incompleta nomeando a etapa', () => {
    expect(problemasDaRegra({ ...COLEGIADA, criterio: '' })).toEqual([
      'A regra de deliberação de uma banca da etapa "Entrevista" está incompleta: corrija os campos marcados.',
    ]);
  });
});
