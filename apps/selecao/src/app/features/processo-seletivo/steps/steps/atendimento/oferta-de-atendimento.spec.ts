import { describe, expect, it } from 'vitest';

import { aposMarcarCondicao, aposMarcarTodas, aposRemover, ehPcd } from './oferta-de-atendimento';

const PCD = { id: 'c-pcd', codigo: 'PCD', nome: 'Pessoa com deficiência' };
const OUTRA_PCD = { id: 'c-pcd-2', codigo: 'pcd', nome: 'Pessoa com deficiência (nova)' };
const PPI = { id: 'c-ppi', codigo: 'PPI', nome: 'Pessoa preta, parda ou indígena' };

describe('regra do PcD na oferta de atendimento', () => {
  it('reconhece o código PcD sem diferenciar a caixa', () => {
    expect(ehPcd('PCD')).toBe(true);
    expect(ehPcd('pcd')).toBe(true);
    expect(ehPcd('PPI')).toBe(false);
  });

  it('desmarcar a única condição PcD esvazia os tipos de deficiência', () => {
    expect(aposMarcarCondicao([PCD, PPI], PCD, false)).toEqual({
      condicoes: [PPI],
      tiposDeficiencia: [],
    });
  });

  it('desmarcar a condição PcD mantém os tipos quando outra condição PcD resta', () => {
    expect(aposMarcarCondicao([PCD, OUTRA_PCD], PCD, false)).toEqual({ condicoes: [OUTRA_PCD] });
  });

  it('marcar todas sem nenhuma condição PcD esvazia os tipos de deficiência', () => {
    expect(aposMarcarTodas([], [PPI], true)).toEqual({ condicoes: [PPI], tiposDeficiencia: [] });
    expect(aposMarcarTodas([PCD], [PPI], true)).toEqual({ condicoes: [PCD, PPI] });
  });

  it('remover a condição PcD inativa esvazia os tipos só se nenhuma outra resta', () => {
    expect(aposRemover([PCD, PPI], PCD.id)).toEqual({ condicoes: [PPI], tiposDeficiencia: [] });
    expect(aposRemover([PCD, OUTRA_PCD], PCD.id)).toEqual({ condicoes: [OUTRA_PCD] });
  });
});
