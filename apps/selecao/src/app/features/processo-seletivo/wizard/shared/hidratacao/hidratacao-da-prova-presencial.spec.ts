import { describe, expect, it } from 'vitest';

import { DRAFT, dtoCom } from '../hidratacao.testing';
import { hidratarDraft } from '../hidratacao';
import { provaPresencialDe } from './hidratacao-da-prova-presencial';

const POR_DECLARAR = { temProvaPresencial: null, municipios: [] };

describe('provaPresencialDe', () => {
  it('mantém por declarar quando a propriedade está ausente', () => {
    const dto = dtoCom([]);
    Reflect.deleteProperty(dto, 'provaPresencial');
    expect(provaPresencialDe(dto)).toEqual(POR_DECLARAR);
  });

  it('mantém por declarar quando a propriedade é nula', () => {
    expect(provaPresencialDe(dtoCom([]))).toEqual(POR_DECLARAR);
  });

  it('preserva a declaração de que não há prova', () => {
    const provaPresencial = { temProvaPresencial: false, municipios: [] };
    expect(provaPresencialDe({ ...dtoCom([]), provaPresencial })).toEqual(provaPresencial);
  });

  it('hidrata os municípios na ordem da API, inclusive nomes nulos', () => {
    const provaPresencial = {
      temProvaPresencial: true,
      municipios: [
        { codigoIbge: '1504208', uf: 'PA', nome: null },
        { codigoIbge: '1501402', uf: 'PA', nome: 'Belém' },
      ],
    };
    const dto = { ...dtoCom([]), provaPresencial };
    expect(provaPresencialDe(dto)).toEqual(provaPresencial);
    expect(hidratarDraft(DRAFT, dto).provaPresencial).toEqual(provaPresencial);
  });
});
