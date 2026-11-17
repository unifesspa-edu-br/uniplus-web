import { describe, expect, it } from 'vitest';

import { rotuloDoSentido, SENTIDOS_DE_DECISAO } from './sentidos-de-decisao';

describe('sentidos de decisão', () => {
  it('traz os dois códigos do contrato', () => {
    expect(SENTIDOS_DE_DECISAO.map((sentido) => sentido.codigo)).toEqual([
      'FAVORAVEL',
      'DESFAVORAVEL',
    ]);
  });

  it('dá o nome em português ao código conhecido e devolve o código desconhecido', () => {
    expect(rotuloDoSentido('DESFAVORAVEL')).toBe('Desfavorável ao candidato');
    expect(rotuloDoSentido('DESCONHECIDO')).toBe('DESCONHECIDO');
  });
});
