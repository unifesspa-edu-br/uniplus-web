import { describe, expect, it } from 'vitest';

import { exibidoQuando, item } from './conteudos-de-exemplo.testing';
import { alternativaSemOProprioCampo, comImpedimento, impedimentoCabe } from './impedimento';

describe('impedimentoCabe', () => {
  it('o impedimento só cabe na inscrição, em tipo admitido e com o próprio campo citável', () => {
    expect(impedimentoCabe('INSCRICAO', 'SIM_OU_NAO', true)).toBe(true);
    expect(impedimentoCabe('HABILITACAO', 'SIM_OU_NAO', true)).toBe(false);
    expect(impedimentoCabe('INSCRICAO', 'TEXTO', true)).toBe(false);
    expect(impedimentoCabe('INSCRICAO', 'ESCOLHA_UNICA', false)).toBe(false);
  });

  it('o campo de município admite impedimento', () => {
    expect(impedimentoCabe('INSCRICAO', 'MUNICIPIO', true)).toBe(true);
  });
});

describe('comImpedimento', () => {
  it('ligar o impedimento deixa o campo obrigatório sempre na mesma edição', () => {
    const opcional = item('VINCULO', 0, 'S1', {
      regras: {
        obrigatoriedade: { tipo: 'QUANDO', predicado: exibidoQuando('X') },
      },
    });

    const ligado = comImpedimento(opcional, exibidoQuando('VINCULO'));

    expect(ligado.regras.obrigatoriedade).toEqual({ tipo: 'SEMPRE', predicado: null });
  });
});

describe('alternativaSemOProprioCampo', () => {
  it('acusa a alternativa do impedimento que não cita o próprio campo', () => {
    expect(
      alternativaSemOProprioCampo([[{ fato: 'V', operador: 'IGUAL', valor: true }]], 'V'),
    ).toBe(false);
    expect(
      alternativaSemOProprioCampo(
        [
          [{ fato: 'V', operador: 'IGUAL', valor: true }],
          [{ fato: 'X', operador: 'IGUAL', valor: true }],
        ],
        'V',
      ),
    ).toBe(true);
    expect(alternativaSemOProprioCampo(null, 'V')).toBe(true);
  });
});
