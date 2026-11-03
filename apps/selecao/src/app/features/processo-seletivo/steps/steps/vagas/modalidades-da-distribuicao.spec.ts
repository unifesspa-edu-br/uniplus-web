import { describe, expect, it } from 'vitest';

import { modalidadesDoRol } from './modalidades-da-distribuicao';

describe('modalidadesDoRol', () => {
  const CATALOGO_COMPLETO = [{ codigo: 'AC' }, { codigo: 'AC_I' }, { codigo: 'AC_Q' }];

  it('devolve o catálogo inteiro quando o rol é aberto (null)', () => {
    expect(modalidadesDoRol(CATALOGO_COMPLETO, null)).toEqual(CATALOGO_COMPLETO);
  });

  it('restringe ao rol fechado, na ordem do catálogo', () => {
    expect(modalidadesDoRol(CATALOGO_COMPLETO, ['AC_I', 'AC_Q']).map((m) => m.codigo)).toEqual([
      'AC_I',
      'AC_Q',
    ]);
  });

  it('devolve vazio quando nenhuma modalidade do catálogo está no rol', () => {
    expect(modalidadesDoRol(CATALOGO_COMPLETO, ['AC_PCD'])).toEqual([]);
  });
});
