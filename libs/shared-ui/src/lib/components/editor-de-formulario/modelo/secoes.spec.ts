import { describe, expect, it } from 'vitest';

import {
  NOMES,
  REVISAO,
  conteudo,
  exibidoQuando,
  item,
  secao,
} from './conteudos-de-exemplo.testing';
import { acrescentarSecao, moverEtapa } from './secoes';

describe('acrescentarSecao', () => {
  it('a seção nova entra antes da revisão e aceite, que continua a última', () => {
    const novo = acrescentarSecao(conteudo({ etapas: [secao('SECAO_1', 0), REVISAO] }), 'Nova');

    expect(novo.etapas?.map((e) => [e.codigo, e.ordem])).toEqual([
      ['SECAO_1', 0],
      ['SECAO_2', 1],
      ['REVISAO_E_ACEITE', 2],
    ]);
  });
});

describe('moverEtapa', () => {
  it('recusa pôr antes a seção cujo item cita fato da seção que fica depois', () => {
    const atual = conteudo({
      etapas: [secao('S1', 0), secao('S2', 1), REVISAO],
      itens: [
        item('A', 0, 'S1'),
        item('B', 1, 'S2', {
          regras: { obrigatoriedade: { tipo: 'QUANDO', predicado: exibidoQuando('A') } },
        }),
      ],
    });

    expect(moverEtapa(atual, 'S2', -1, NOMES).ok).toBe(false);
  });

  it('recusa quando a exibição da seção passaria a citar fato posterior', () => {
    const atual = conteudo({
      etapas: [secao('S1', 0), secao('S2', 1, exibidoQuando('A')), REVISAO],
      itens: [item('A', 0, 'S1'), item('B', 1, 'S2')],
    });

    expect(moverEtapa(atual, 'S2', -1, NOMES).ok).toBe(false);
  });

  it('leva os itens junto e os renumera na ordem nova das seções', () => {
    const atual = conteudo({
      etapas: [secao('S1', 0), secao('S2', 1), REVISAO],
      itens: [item('A', 0, 'S1'), item('B', 1, 'S2')],
    });

    const resultado = moverEtapa(atual, 'S2', -1, NOMES);

    expect(resultado.ok && resultado.conteudo.itens?.map((i) => [i.fatoCodigo, i.ordem])).toEqual([
      ['A', 1],
      ['B', 0],
    ]);
  });
});
