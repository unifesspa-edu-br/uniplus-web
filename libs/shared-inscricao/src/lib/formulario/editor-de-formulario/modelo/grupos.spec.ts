import { describe, expect, it } from 'vitest';

import {
  conteudo,
  exibidoQuando,
  fato,
  grupoDeExemplo as grupo,
  item,
  membro,
  secao,
} from './conteudos-de-exemplo.testing';
import {
  acrescentarCampoAoGrupo,
  acrescentarGrupo,
  fatosCitaveisPeloCampoDoGrupo,
  moverCampoNoGrupo,
  quantidadeNoTeto,
  removerCampoDoGrupo,
} from './grupos';

describe('acrescentarGrupo', () => {
  const criar = (rotulo: string, catalogo = [membro('RENDA')]) =>
    acrescentarGrupo(
      conteudo({}),
      { rotulo, paginaCodigo: 'S1', primeiroCampo: membro('RENDA') },
      catalogo,
    );

  it('escreve por extenso o número inicial', () => {
    const resultado = criar('1ª etapa');
    expect(resultado.ok && resultado.conteudo.grupos?.[0].codigo).toBe('PRIMEIRA_ETAPA');
  });

  it('aceita código com 60 caracteres sem cortar', () => {
    const resultado = criar('a'.repeat(60));
    expect(resultado.ok && resultado.conteudo.grupos?.[0].codigo).toBe('A'.repeat(60));
  });

  it('recusa código com 61 caracteres sem repetir o rótulo', () => {
    expect(criar('a'.repeat(61))).toEqual({
      ok: false,
      recusa:
        'O código formado a partir deste rótulo passa de 60 caracteres. Use um rótulo mais curto.',
    });
  });

  it('recusa quando o sufixo ultrapassa o limite', () => {
    expect(criar('a'.repeat(60), [fato('A'.repeat(60))]).ok).toBe(false);
  });

  it('o grupo nasce com o primeiro campo, sem seção própria, e com código do rótulo que não colide com fato', () => {
    const atual = conteudo({ paginas: [secao('S1', 0)], itens: [item('A', 0, 'S1')] });

    const resultado = acrescentarGrupo(
      atual,
      { rotulo: 'Renda', paginaCodigo: 'S1', primeiroCampo: membro('RENDA') },
      [fato('RENDA'), membro('RENDA')],
    );

    const novo = resultado.ok ? resultado.conteudo.grupos?.[0] : undefined;
    expect(novo?.codigo, 'RENDA é código de fato').toBe('RENDA_2');
    expect(novo?.subitens.map((c) => [c.fatoCodigo, c.paginaCodigo])).toEqual([['RENDA', null]]);
    expect(novo?.ordem).toBe(1);
  });

  it('o grupo sem rótulo é recusado antes de existir', () => {
    expect(
      acrescentarGrupo(
        conteudo({ paginas: [secao('S1', 0)] }),
        { rotulo: '  ', paginaCodigo: 'S1', primeiroCampo: membro('RENDA') },
        [],
      ).ok,
    ).toBe(false);
  });
});

describe('campos do grupo', () => {
  it('recusa remover o último campo e o parentesco do grupo que inclui o candidato', () => {
    const nomes = new Map<string, string>();
    expect(
      removerCampoDoGrupo(grupo({ subitens: [item('RENDA', 0, 'S1')] }), 'RENDA', nomes).ok,
    ).toBe(false);
    const comCandidato = grupo({
      ocorrencias: { minimo: 0, maximo: null, incluiCandidato: true },
      subitens: [item('PARENTESCO', 0, 'S1'), item('RENDA', 1, 'S1')],
    });
    expect(removerCampoDoGrupo(comCandidato, 'PARENTESCO', nomes).ok).toBe(false);
    expect(removerCampoDoGrupo(comCandidato, 'RENDA', nomes).ok).toBe(true);
  });

  it('recusa mover dentro do grupo o campo que passaria a citar outro que vem depois', () => {
    const citante = grupo({
      subitens: [
        item('RENDA', 0, 'S1'),
        item('IDADE', 1, 'S1', { regras: { exibicao: exibidoQuando('RENDA') } }),
      ],
    });

    expect(moverCampoNoGrupo(citante, 'IDADE', -1, new Map()).ok).toBe(false);
    expect(moverCampoNoGrupo(grupo(), 'IDADE', -1, new Map()).ok).toBe(true);
  });

  it('o campo do grupo cita o conhecido antes do grupo e os campos anteriores da ocorrência', () => {
    const atual = conteudo({
      paginas: [secao('S1', 0)],
      itens: [item('A', 0, 'S1'), item('DEPOIS', 2, 'S1')],
      grupos: [grupo()],
    });

    expect([...fatosCitaveisPeloCampoDoGrupo(atual, grupo(), 'IDADE')].sort()).toEqual([
      'A',
      'RENDA',
    ]);
  });

  it('o campo novo vai ao fim do grupo mesmo quando a ordem gravada começa acima de zero', () => {
    const gravado = grupo({ subitens: [item('RENDA', 1, 'S1'), item('IDADE', 2, 'S1')] });

    const resultado = acrescentarCampoAoGrupo(
      conteudo({ grupos: [gravado] }),
      gravado,
      membro('NOVO'),
    );

    expect(resultado.ok && resultado.grupo.subitens.map((c) => [c.fatoCodigo, c.ordem])).toEqual([
      ['RENDA', 0],
      ['IDADE', 1],
      ['NOVO', 2],
    ]);
  });
});

describe('teto de campos', () => {
  it('o teto conta itens, grupos e campos de grupo, como a API', () => {
    const atual = conteudoComGrupoNoTeto();
    expect(quantidadeNoTeto(atual)).toBe(4);
  });

  it('o grupo chega ao teto de trinta campos', () => {
    const cheio = grupo({ subitens: Array.from({ length: 30 }, (_, i) => item(`C${i}`, i, 'S1')) });
    expect(acrescentarCampoAoGrupo(conteudo({ grupos: [cheio] }), cheio, membro('NOVO')).ok).toBe(
      false,
    );
  });

  it('o campo do grupo respeita também o teto do formulário inteiro', () => {
    const itens = Array.from({ length: 197 }, (_, i) => item(`I${i}`, i, 'S1'));
    const noTeto = conteudo({ itens, grupos: [grupo()] });

    expect(
      acrescentarCampoAoGrupo(noTeto, grupo(), membro('NOVO')).ok,
      '197 itens + grupo + 2 campos = 200',
    ).toBe(false);
  });
});

function conteudoComGrupoNoTeto() {
  return conteudo({
    itens: [item('A', 0, 'S1')],
    grupos: [
      grupo({
        codigo: 'G',
        ordem: 1,
        rotulo: 'G',
        paginaCodigo: 'S1',
        ocorrencias: { minimo: 0, maximo: null, incluiCandidato: false },
        regras: { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
        subitens: [item('M1', 0, 'S1'), item('M2', 1, 'S1')],
      }),
    ],
  });
}
