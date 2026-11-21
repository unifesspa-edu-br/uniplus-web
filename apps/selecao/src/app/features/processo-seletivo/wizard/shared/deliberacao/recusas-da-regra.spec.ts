import { describe, expect, it } from 'vitest';

import { CAMPOS_DA_BANCA, errosDaBancaPorCampo } from './recusas-da-regra';

describe('errosDaBancaPorCampo', () => {
  it('reúne só os campos que têm erro', () => {
    const erros = errosDaBancaPorCampo((campo) => (campo === 'quorum' ? 'fora' : null));

    expect(erros).toEqual({ quorum: 'fora' });
  });

  it('ignora o erro vazio ou indefinido', () => {
    expect(errosDaBancaPorCampo((campo) => (campo === 'modo' ? '' : undefined))).toEqual({});
  });

  it('consulta cada lugar sob o qual a recusa pode aparecer', () => {
    const consultados: string[] = [];
    errosDaBancaPorCampo((campo) => {
      consultados.push(campo);
      return null;
    });

    expect(consultados).toEqual([...CAMPOS_DA_BANCA]);
  });
});
