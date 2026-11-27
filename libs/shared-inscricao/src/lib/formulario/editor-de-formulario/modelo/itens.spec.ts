import { describe, expect, it } from 'vitest';

import {
  NOMES,
  REVISAO,
  conteudo,
  exibidoQuando,
  grupoDeExemplo,
  item,
  secao,
} from './conteudos-de-exemplo.testing';
import { moverEntrada, moverItem, removerItem } from './itens';

describe('moverItem', () => {
  const base = conteudo({
    paginas: [secao('S1', 0), REVISAO],
    itens: [
      item('A', 0, 'S1'),
      item('B', 1, 'S1', { regras: { exibicao: exibidoQuando('A') } }),
      item('C', 2, 'S1'),
    ],
  });

  it('troca de lugar com o vizinho quando nenhuma citação se inverte', () => {
    const resultado = moverItem(base, 'C', -1, NOMES);

    expect(resultado.ok && resultado.conteudo.itens?.map((i) => [i.fatoCodigo, i.ordem])).toEqual([
      ['A', 0],
      ['B', 2],
      ['C', 1],
    ]);
  });

  it.each([
    ['o item que cita para antes do citado', 'B', -1 as const],
    ['o citado para depois do item que o cita', 'A', 1 as const],
  ])('recusa mover %s, explicando quem cita quem', (_caso, fatoCodigo, direcao) => {
    const resultado = moverItem(base, fatoCodigo, direcao, NOMES);

    expect(resultado).toEqual({
      ok: false,
      recusa: '“B” cita “Campo A”, que ficaria depois. Mova primeiro o campo citado.',
    });
  });

  it('recusa descer o campo para depois do grupo cujo campo o cita', () => {
    const comGrupo = conteudo({
      paginas: [secao('S1', 0)],
      itens: [item('A', 0, 'S1')],
      grupos: [
        {
          codigo: 'FAMILIA',
          ordem: 1,
          rotulo: 'Família',
          paginaCodigo: 'S1',
          ocorrencias: { minimo: 0, maximo: null, incluiCandidato: false },
          regras: { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
          subitens: [item('PARENTESCO', 0, 'S1', { regras: { exibicao: exibidoQuando('A') } })],
        },
      ],
    });

    expect(moverItem(comGrupo, 'A', 1, NOMES)).toEqual({
      ok: false,
      recusa: 'O grupo “Família” cita “Campo A”, que ficaria depois. Mova primeiro o campo citado.',
    });
  });

  it.each([
    [
      'a condição de um grupo das opções permitidas',
      { tipo: 'OPCOES_PERMITIDAS', entradas: [{ quando: exibidoQuando('A'), valores: ['X'] }] },
    ],
    [
      'o campo de onde vêm as opções formadas pelas respostas',
      { tipo: 'OPCOES_DAS_RESPOSTAS', fatos: ['A'] },
    ],
  ])('recusa pôr o campo antes do que %s cita', (_caso, restricao) => {
    const atual = conteudo({
      paginas: [secao('S1', 0), REVISAO],
      itens: [
        item('A', 0, 'S1'),
        item('B', 1, 'S1', {
          apresentacao: { tipoDeCampo: 'ESCOLHA_UNICA' },
          regras: { restricoes: [restricao] },
        }),
      ],
    });

    expect(moverItem(atual, 'B', -1, NOMES)).toEqual({
      ok: false,
      recusa: '“B” cita “Campo A”, que ficaria depois. Mova primeiro o campo citado.',
    });
  });

  it('o pressuposto é conhecido antes de todo item e não impede o movimento', () => {
    const comPressuposto = conteudo({
      ...base,
      pressupostos: ['A'],
      itens: [item('B', 0, 'S1', { regras: { exibicao: exibidoQuando('A') } }), item('C', 1, 'S1')],
    });

    expect(moverItem(comPressuposto, 'B', 1, NOMES).ok).toBe(true);
  });
});

describe('moverEntrada', () => {
  it('o grupo troca de lugar com o item vizinho como qualquer entrada da seção', () => {
    const atual = conteudo({
      paginas: [secao('S1', 0)],
      itens: [item('A', 0, 'S1')],
      grupos: [grupoDeExemplo()],
    });

    const resultado = moverEntrada(atual, { tipo: 'grupo', codigo: 'FAMILIA' }, -1, new Map());

    expect(
      resultado.ok && [resultado.conteudo.grupos?.[0].ordem, resultado.conteudo.itens?.[0].ordem],
    ).toEqual([0, 1]);
  });
});

describe('removerItem', () => {
  it('recusa remover o campo que outra regra cita, inclusive o impedimento de outro campo', () => {
    const atual = conteudo({
      paginas: [secao('S1', 0)],
      itens: [
        item('A', 0, 'S1'),
        item('B', 1, 'S1', {
          regras: { impedimento: { quando: exibidoQuando('A'), mensagem: 'Não pode.' } },
        }),
      ],
    });

    expect(removerItem(atual, 'A', NOMES)).toEqual({
      ok: false,
      recusa: 'Não é possível remover “Campo A”: o campo “B” cita esse campo.',
    });
    expect(removerItem(atual, 'B', NOMES).ok).toBe(true);
  });

  it('recusa remover o campo que a condição de um documento exigido cita', () => {
    const atual = conteudo({
      paginas: [secao('S1', 0)],
      itens: [item('A', 0, 'S1')],
      documentosExigidos: [
        {
          faseCodigo: 'INSCRICAO',
          tipoDocumentoCodigo: 'LAUDO',
          obrigatorio: true,
          quando: exibidoQuando('A'),
          consequenciaDoDescumprimento: 'ELIMINA_DO_PROCESSO',
          abrePrazoParaReenvio: false,
          basesLegais: [],
        },
      ],
    });

    expect(removerItem(atual, 'A', NOMES)).toEqual({
      ok: false,
      recusa: 'Não é possível remover “Campo A”: o documento exigido LAUDO cita esse campo.',
    });
  });
});
