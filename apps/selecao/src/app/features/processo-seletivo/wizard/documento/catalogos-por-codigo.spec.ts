import { describe, expect, it } from 'vitest';

import { catalogoPorCodigo, rotuloDoCodigo } from './catalogos-por-codigo';

describe('rótulo do código', () => {
  const catalogo = catalogoPorCodigo([{ codigo: 'CEPS', rotulo: 'Rótulo do catálogo vivo' }]);

  it('prefere o rótulo que o processo gravou ao do catálogo vivo', () => {
    expect(rotuloDoCodigo(catalogo, 'CEPS', 'Rótulo congelado')).toBe('Rótulo congelado');
  });

  it('usa o catálogo quando o item ainda não tem rótulo gravado', () => {
    expect(rotuloDoCodigo(catalogo, 'CEPS', undefined)).toBe('Rótulo do catálogo vivo');
  });

  it('identifica o item pelo código quando nenhum dos dois sabe o rótulo', () => {
    expect(rotuloDoCodigo(catalogo, 'EXTINTA', undefined)).toBe('EXTINTA');
  });
});
