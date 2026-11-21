import { describe, expect, it } from 'vitest';

import { REVISAO, conteudo, fato, item, secao } from './conteudos-de-exemplo.testing';
import { acrescentarItem } from './itens';

describe('numeração das entradas', () => {
  it('acrescenta no fim da seção e numera itens e grupos numa ordem única que segue a das seções', () => {
    const atual = conteudo({
      etapas: [secao('S1', 0), secao('S2', 1), REVISAO],
      itens: [item('A', 0, 'S1'), item('C', 2, 'S2')],
      grupos: [
        {
          codigo: 'FAMILIA',
          ordem: 1,
          rotulo: 'Família',
          etapaCodigo: 'S1',
          ocorrencias: { minimo: 0, maximo: null, incluiCandidato: true },
          regras: { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
          subitens: [],
        },
      ],
    });

    const novo = acrescentarItem(atual, fato('B'), 'S1');

    expect(novo.itens?.map((i) => [i.fatoCodigo, i.ordem])).toEqual([
      ['A', 0],
      ['C', 3],
      ['B', 2],
    ]);
    expect(novo.grupos?.[0].ordem).toBe(1);
  });
});
