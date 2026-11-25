import { describe, expect, it } from 'vitest';

import { titulosDasOcorrencias } from './ocorrencia-do-candidato';

const candidato = { PARENTESCO: 'PROPRIO_CANDIDATO' };
const filho = { PARENTESCO: 'FILHO' };

describe('titulosDasOcorrencias', () => {
  it('chama o candidato de "Você (candidato)" e numera os integrantes a partir de 1', () => {
    expect(titulosDasOcorrencias(true, [filho, candidato, filho])).toEqual([
      'Integrante 1',
      'Você (candidato)',
      'Integrante 2',
    ]);
  });

  it('só a primeira ocorrência com o parentesco do candidato é a dele', () => {
    expect(titulosDasOcorrencias(true, [candidato, candidato])).toEqual([
      'Você (candidato)',
      'Integrante 1',
    ]);
  });

  it('no grupo que não inclui o candidato, todos são integrantes', () => {
    expect(titulosDasOcorrencias(false, [candidato, null])).toEqual([
      'Integrante 1',
      'Integrante 2',
    ]);
  });
});
