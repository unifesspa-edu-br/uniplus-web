import { describe, expect, it } from 'vitest';

import { recusaSemAreas, situacaoDoQuadro } from './situacao-do-quadro';
import {
  GRAVADA,
  ESCOLHIDA,
  grupos,
  classificacao,
  lido,
  CARREGANDO,
  FALHOU,
  comQuadro,
  NUNCA,
} from './quadro-do-desempate.testing';

describe('situacaoDoQuadro', () => {
  it('com a classificação gravada desconhecida, não afirma quadro nenhum', () => {
    const situacao = situacaoDoQuadro(
      classificacao(GRAVADA),
      { estado: 'desconhecida' },
      lido(grupos('REDACAO')),
    );

    expect(situacao).toEqual({ tipo: 'por-reler', motivo: 'desconhecida' });
  });

  it('com a cópia por confirmar, não afirma os valores dela: falta a releitura', () => {
    const situacao = situacaoDoQuadro(
      classificacao(GRAVADA),
      comQuadro(GRAVADA, grupos('REDACAO'), false),
      lido(grupos('REDACAO')),
    );

    expect(situacao).toEqual({ tipo: 'por-reler', motivo: 'por-confirmar' });
  });

  it('gravada sem quadro, vale o quadro que a próxima gravação copia do cadastro', () => {
    expect(
      situacaoDoQuadro(classificacao(GRAVADA), { estado: 'sem-quadro' }, lido(grupos('REDACAO'))),
    ).toMatchObject({ tipo: 'lido', aceitas: [{ codigo: 'REDACAO' }], divergencia: null });
    expect(situacaoDoQuadro(classificacao(null), { estado: 'sem-quadro' }, CARREGANDO)).toEqual({
      tipo: 'sem-quadro',
    });
  });

  it('com o quadro gravado e o rascunho fora do ENEM, a próxima gravação recusa', () => {
    expect(
      situacaoDoQuadro(classificacao(null), comQuadro(GRAVADA, grupos('REDACAO')), CARREGANDO),
    ).toEqual({ tipo: 'rascunho-sem-quadro' });
  });

  it('com o cadastro lido sem a resolução escolhida, ela está fora do cadastro, gravada ou não', () => {
    expect(
      situacaoDoQuadro(classificacao(GRAVADA), comQuadro(GRAVADA, grupos('REDACAO')), lido([])),
    ).toEqual({ tipo: 'fora-do-cadastro' });
    expect(
      situacaoDoQuadro(classificacao(ESCOLHIDA), comQuadro(GRAVADA, grupos('REDACAO')), lido([])),
    ).toEqual({ tipo: 'fora-do-cadastro' });
    expect(situacaoDoQuadro(classificacao(ESCOLHIDA), NUNCA, lido([]))).toEqual({
      tipo: 'fora-do-cadastro',
    });
  });

  it('sem o cadastro lido, a cópia gravada decide, e outra resolução fica a confirmar', () => {
    const situacao = situacaoDoQuadro(
      classificacao(ESCOLHIDA),
      comQuadro(GRAVADA, grupos('REDACAO')),
      CARREGANDO,
    );

    expect(situacao).toMatchObject({
      tipo: 'lido',
      aceitas: [{ codigo: 'REDACAO' }],
      divergencia: { tipo: 'a-confirmar', gravada: GRAVADA },
    });
  });

  it('com outra resolução escolhida, valem as áreas que as duas têm em todos os grupos', () => {
    const situacao = situacaoDoQuadro(
      classificacao(ESCOLHIDA),
      comQuadro(GRAVADA, grupos('LINGUAGENS', 'REDACAO')),
      lido(grupos('REDACAO', 'MATEMATICA')),
    );

    expect(situacao).toMatchObject({
      tipo: 'lido',
      aceitas: [{ codigo: 'REDACAO' }],
      divergencia: { tipo: 'outra-resolucao', gravada: GRAVADA, escolhida: ESCOLHIDA },
    });
  });

  it('com a mesma resolução mudada no cadastro, valem as áreas que a cópia e o cadastro têm', () => {
    const situacao = situacaoDoQuadro(
      classificacao(GRAVADA),
      comQuadro(GRAVADA, grupos('LINGUAGENS', 'REDACAO')),
      lido(grupos('REDACAO')),
    );

    expect(situacao).toMatchObject({
      tipo: 'lido',
      aceitas: [{ codigo: 'REDACAO' }],
      divergencia: { tipo: 'cadastro-alterado', gravada: GRAVADA },
    });
  });

  it('sem área que a cópia e o quadro da escolhida tenham juntos, não há o que oferecer', () => {
    expect(
      situacaoDoQuadro(
        classificacao(ESCOLHIDA),
        comQuadro(GRAVADA, grupos('LINGUAGENS')),
        lido(grupos('REDACAO')),
      ),
    ).toMatchObject({
      tipo: 'resolucoes-sem-area-em-comum',
      gravada: GRAVADA,
      escolhida: ESCOLHIDA,
    });
  });

  it('sem classificação gravada, o quadro vem do cadastro: carregando, em falha ou lido', () => {
    expect(situacaoDoQuadro(classificacao(''), NUNCA, CARREGANDO)).toEqual({
      tipo: 'sem-resolucao',
    });
    expect(situacaoDoQuadro(classificacao(ESCOLHIDA), NUNCA, CARREGANDO)).toEqual({
      tipo: 'carregando',
    });
    expect(situacaoDoQuadro(classificacao(ESCOLHIDA), NUNCA, FALHOU)).toEqual({
      tipo: 'falha',
      mensagem: 'Não foi possível.',
    });
    // A nova tentativa em curso depois de uma falha já não é a falha.
    expect(
      situacaoDoQuadro(classificacao(ESCOLHIDA), NUNCA, { ...FALHOU, carregando: true }),
    ).toEqual({ tipo: 'carregando' });
    expect(
      situacaoDoQuadro(classificacao(ESCOLHIDA), NUNCA, lido(grupos('REDACAO', 'MATEMATICA'))),
    ).toMatchObject({
      tipo: 'lido',
      aceitas: [{ codigo: 'MATEMATICA' }, { codigo: 'REDACAO' }],
      divergencia: null,
    });
  });
});

describe('recusaSemAreas', () => {
  it('é a dica da situação, sem a maiúscula e o ponto', () => {
    expect(recusaSemAreas({ tipo: 'por-reler', motivo: 'por-confirmar' })).toBe(
      'o quadro de Peso por Área que a última gravação da classificação congelou no processo ainda não foi confirmado por uma releitura, e as áreas que o desempate pode citar dependem disso; releia o processo pelo aviso no início do passo',
    );
  });

  it('não recusa quando há áreas a oferecer, nem enquanto o cadastro carrega', () => {
    const oferece = situacaoDoQuadro(classificacao(ESCOLHIDA), NUNCA, lido(grupos('REDACAO')));

    expect(recusaSemAreas(oferece)).toBeNull();
    expect(recusaSemAreas({ tipo: 'carregando' })).toBeNull();
  });
});
