import { describe, expect, it } from 'vitest';

import { umCronogramaCompleto } from '../cronograma.testing';
import { naFase } from './fases-do-cronograma.edicao';

describe('na fase', () => {
  it('edita só a fase da chave', () => {
    const documento = umCronogramaCompleto();

    const editado = naFase(documento, 'resultado', (fase) => ({
      ...fase,
      emiteParecerIndividual: true,
    }));

    expect(editado.cronograma?.fases?.map((fase) => fase.emiteParecerIndividual)).toEqual([
      undefined,
      undefined,
      true,
    ]);
  });

  it('não muda nada quando a chave não existe', () => {
    const documento = umCronogramaCompleto();

    expect(naFase(documento, 'inexistente', (fase) => fase)).toBe(documento);
  });
});
