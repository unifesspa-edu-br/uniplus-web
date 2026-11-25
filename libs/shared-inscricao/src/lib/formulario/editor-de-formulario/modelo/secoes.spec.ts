import { describe, expect, it } from 'vitest';

import {
  NOMES,
  REVISAO,
  conteudo,
  exibidoQuando,
  item,
  secao,
} from './conteudos-de-exemplo.testing';
import {
  acrescentarBloco,
  acrescentarSecao,
  comPagina,
  moverPagina,
  podeMoverPagina,
  removerPagina,
} from './secoes';

describe('acrescentarSecao', () => {
  it('a seção nova entra antes da revisão e aceite, que continua a última', () => {
    const novo = acrescentarSecao(conteudo({ paginas: [secao('SECAO_1', 0), REVISAO] }), 'Nova');

    expect(novo.paginas?.map((e) => [e.codigo, e.ordem])).toEqual([
      ['SECAO_1', 0],
      ['SECAO_2', 1],
      ['REVISAO_E_ACEITE', 2],
    ]);
  });
});

it('substitui apenas a página com o mesmo código', () => {
  const atual = conteudo({ paginas: [secao('S1', 0), secao('S2', 1)] });
  const editada = secao('S1', 4);
  expect(comPagina(atual, editada).paginas).toEqual([editada, secao('S2', 1)]);
});

it('acrescenta bloco ao final quando não há revisão', () => {
  const novo = acrescentarBloco(conteudo({ paginas: [secao('S1', 0)] }), {
    valor: 'BLOCO',
    rotulo: 'Bloco',
  });
  expect(novo.paginas?.map((p) => p.codigo)).toEqual(['S1', 'BLOCO']);
});

it('recusa movimento além da primeira página', () => {
  const atual = conteudo({ paginas: [secao('S1', 0)] });
  expect(podeMoverPagina(atual, 'S1', -1)).toBe(false);
  expect(moverPagina(atual, 'S1', -1, NOMES)).toEqual({
    ok: false,
    recusa: 'Não há para onde mover nessa direção.',
  });
});

it('recusa remover seção com campo', () => {
  const atual = conteudo({ paginas: [secao('S1', 0)], itens: [item('A', 0, 'S1')] });
  expect(removerPagina(atual, 'S1').ok).toBe(false);
});

it('remove seção vazia e mantém a revisão', () => {
  const atual = conteudo({ paginas: [secao('S1', 0), REVISAO] });
  const resultado = removerPagina(atual, 'S1');
  expect(resultado.ok && resultado.conteudo.paginas?.map((p) => p.codigo)).toEqual([
    'REVISAO_E_ACEITE',
  ]);
});

it('recusa remover página ausente ou revisão fixa', () => {
  const atual = conteudo({ paginas: [REVISAO] });
  expect(removerPagina(atual, 'AUSENTE').ok).toBe(false);
  expect(removerPagina(atual, REVISAO.codigo).ok).toBe(false);
});

describe('moverPagina', () => {
  it('recusa pôr antes a seção cujo item cita fato da seção que fica depois', () => {
    const atual = conteudo({
      paginas: [secao('S1', 0), secao('S2', 1), REVISAO],
      itens: [
        item('A', 0, 'S1'),
        item('B', 1, 'S2', {
          regras: { obrigatoriedade: { tipo: 'QUANDO', predicado: exibidoQuando('A') } },
        }),
      ],
    });

    expect(moverPagina(atual, 'S2', -1, NOMES).ok).toBe(false);
  });

  it('recusa quando a exibição da seção passaria a citar fato posterior', () => {
    const atual = conteudo({
      paginas: [secao('S1', 0), secao('S2', 1, exibidoQuando('A')), REVISAO],
      itens: [item('A', 0, 'S1'), item('B', 1, 'S2')],
    });

    expect(moverPagina(atual, 'S2', -1, NOMES).ok).toBe(false);
  });

  it('leva os itens junto e os renumera na ordem nova das seções', () => {
    const atual = conteudo({
      paginas: [secao('S1', 0), secao('S2', 1), REVISAO],
      itens: [item('A', 0, 'S1'), item('B', 1, 'S2')],
    });

    const resultado = moverPagina(atual, 'S2', -1, NOMES);

    expect(resultado.ok && resultado.conteudo.itens?.map((i) => [i.fatoCodigo, i.ordem])).toEqual([
      ['A', 1],
      ['B', 0],
    ]);
  });
});
