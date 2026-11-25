import { describe, expect, it } from 'vitest';

import { fatosCitaveisPeloItem, fatosQueExigemResposta } from './citacoes';
import { conteudo, item, secao } from './conteudos-de-exemplo.testing';

describe('citações entre campos', () => {
  it('as condições do item citam só os campos anteriores e os pressupostos, nunca o próprio', () => {
    const atual = conteudo({
      paginas: [secao('S1', 0)],
      pressupostos: ['P'],
      itens: [item('A', 0, 'S1'), item('B', 1, 'S1'), item('C', 2, 'S1')],
    });

    expect([...fatosCitaveisPeloItem(atual, 'B')].sort()).toEqual(['A', 'P']);
  });

  it('o campo citado por negação ou com impedimento precisa de resposta; o citado por igualdade não', () => {
    const atual = conteudo({
      itens: [
        item('X', 0, 'S1', {
          regras: {
            exibicao: [
              [
                { fato: 'NEGADO', operador: 'NENHUM_DE', valor: ['A'] },
                { fato: 'IGUAL', operador: 'IGUAL', valor: true },
              ],
            ],
          },
        }),
        item('IMPEDIDO', 1, 'S1', { regras: { impedimento: { quando: null, mensagem: null } } }),
      ],
    });

    expect([...fatosQueExigemResposta(atual)].sort()).toEqual(['IMPEDIDO', 'NEGADO']);
  });
});
