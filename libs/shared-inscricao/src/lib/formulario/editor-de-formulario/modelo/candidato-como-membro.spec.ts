import { describe, expect, it } from 'vitest';

import { incluirCandidatoComoMembro } from './candidato-como-membro';
import {
  conteudo,
  exibidoQuando,
  grupoDeExemplo as grupo,
  item,
  parentesco,
} from './conteudos-de-exemplo.testing';

describe('incluirCandidatoComoMembro', () => {
  it('incluir o candidato põe o parentesco primeiro, obrigatório, sem exibição e com o próprio candidato entre as opções fixas', () => {
    const comParentescoCondicional = grupo({
      subitens: [
        item('RENDA', 0, 'S1', { paginaCodigo: null }),
        item('PARENTESCO', 1, 'S1', {
          paginaCodigo: null,
          regras: {
            obrigatoriedade: { tipo: 'NUNCA', predicado: null },
            exibicao: exibidoQuando('X'),
            restricoes: [
              { tipo: 'OPCOES_PERMITIDAS', entradas: [{ quando: null, valores: ['MAE'] }] },
            ],
          },
        }),
      ],
    });

    const resultado = incluirCandidatoComoMembro(
      conteudo({ grupos: [comParentescoCondicional] }),
      comParentescoCondicional,
      { catalogo: [parentesco], nomes: new Map() },
    );

    const ligado = resultado.ok ? resultado.grupo : undefined;
    expect(ligado?.ocorrencias.minimo).toBe(1);
    expect(ligado?.subitens[0]).toMatchObject({
      fatoCodigo: 'PARENTESCO',
      ordem: 0,
      regras: { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
    });
    expect(ligado?.subitens[0].regras.restricoes?.[0].entradas?.[0].valores).toEqual([
      'MAE',
      'PROPRIO_CANDIDATO',
    ]);
  });

  it('incluir o candidato acrescenta o parentesco quando o grupo não o tem', () => {
    const resultado = incluirCandidatoComoMembro(conteudo({ grupos: [grupo()] }), grupo(), {
      catalogo: [parentesco],
      nomes: new Map(),
    });

    expect(resultado.ok && resultado.grupo.subitens.map((c) => c.fatoCodigo)).toEqual([
      'PARENTESCO',
      'RENDA',
      'IDADE',
    ]);
  });

  it('não acrescenta o parentesco desativado no catálogo', () => {
    const resultado = incluirCandidatoComoMembro(conteudo({ grupos: [grupo()] }), grupo(), {
      catalogo: [{ ...parentesco, ativo: false }],
      nomes: new Map(),
    });

    expect(resultado.ok).toBe(false);
  });

  it('não repete o parentesco que já é campo de outro grupo do formulário', () => {
    const outro = grupo({ codigo: 'OUTRO', subitens: [item('PARENTESCO', 0, 'S1')] });

    const resultado = incluirCandidatoComoMembro(conteudo({ grupos: [outro, grupo()] }), grupo(), {
      catalogo: [parentesco],
      nomes: new Map(),
    });

    expect(resultado.ok).toBe(false);
  });

  it('não acrescenta o parentesco que outra finalidade do processo já coleta', () => {
    const resultado = incluirCandidatoComoMembro(conteudo({ grupos: [grupo()] }), grupo(), {
      catalogo: [parentesco],
      nomes: new Map(),
      indisponiveis: ['PARENTESCO'],
    });

    expect(resultado).toEqual({
      ok: false,
      recusa:
        'O parentesco é respondido em outro formulário — o anterior ou outra finalidade do processo — e por isso não pode ser coletado aqui.',
    });
  });

  it('recusa pôr o parentesco em primeiro quando ele cita um campo anterior do grupo', () => {
    const citante = grupo({
      subitens: [
        item('RENDA', 0, 'S1'),
        item('PARENTESCO', 1, 'S1', {
          regras: {
            exibicao: null,
            restricoes: [
              {
                tipo: 'OPCOES_PERMITIDAS',
                entradas: [{ quando: exibidoQuando('RENDA'), valores: ['MAE'] }],
              },
            ],
          },
        }),
      ],
    });

    expect(
      incluirCandidatoComoMembro(conteudo({ grupos: [citante] }), citante, {
        catalogo: [parentesco],
        nomes: new Map(),
      }).ok,
    ).toBe(false);
  });
});
