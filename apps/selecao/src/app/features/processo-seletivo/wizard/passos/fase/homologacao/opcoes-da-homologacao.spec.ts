import { describe, expect, it } from 'vitest';

import type { ProdutoDaFase } from '../../../processo-seletivo.models';
import type { MotivoNoDocumento } from '../../../shared/motivos/motivo-no-documento';
import { opcoesDoMotivo, opcoesDoResultado } from './opcoes-da-homologacao';

const nome = (codigo: string): string => `Nome de ${codigo}`;

const produto = (atoCodigo: string, papel: ProdutoDaFase['papel']): ProdutoDaFase => ({
  atoCodigo,
  papel,
});

const motivo = (codigo: string, descricao?: string): MotivoNoDocumento => ({
  faseChave: 'fase-1',
  tipoDeDecisaoCodigo: 'HOMOLOGACAO_DAS_INSCRICOES',
  codigo,
  descricao,
});

describe('opcoesDoResultado', () => {
  it('oferece só as publicações da fase que têm papel', () => {
    const produtos = [
      produto('RESULTADO_PRELIMINAR', 'PRELIMINAR'),
      produto('COMUNICADO', null),
      produto('RESULTADO_FINAL', 'DEFINITIVO'),
    ];

    expect(opcoesDoResultado(produtos, null, nome).map((opcao) => opcao.codigo)).toEqual([
      'RESULTADO_PRELIMINAR',
      'RESULTADO_FINAL',
    ]);
  });

  it('oferece uma vez o ato publicado com os dois papéis', () => {
    const produtos = [produto('RESULTADO', 'PRELIMINAR'), produto('RESULTADO', 'DEFINITIVO')];

    expect(opcoesDoResultado(produtos, null, nome)).toEqual([
      { codigo: 'RESULTADO', nome: 'Nome de RESULTADO', publicado: true },
    ]);
  });

  it('não oferece a linha de publicação ainda sem ato', () => {
    expect(opcoesDoResultado([produto('', 'PRELIMINAR')], null, nome)).toEqual([]);
  });

  it('mantém, marcado, o resultado apontado que a fase deixou de publicar', () => {
    const opcoes = opcoesDoResultado([produto('RESULTADO_FINAL', 'DEFINITIVO')], 'GABARITO', nome);

    expect(opcoes[1]).toEqual({ codigo: 'GABARITO', nome: 'Nome de GABARITO', publicado: false });
  });
});

describe('opcoesDoMotivo', () => {
  it('oferece a descrição de cada motivo que a fase escolheu', () => {
    expect(
      opcoesDoMotivo([motivo('SEM_RESULTADO_INEP', 'Sem resultado no retorno do INEP.')], null),
    ).toEqual([
      {
        codigo: 'SEM_RESULTADO_INEP',
        rotulo: 'Sem resultado no retorno do INEP.',
        escolhidoPelaFase: true,
      },
    ]);
  });

  it('usa o código quando o motivo não traz descrição', () => {
    expect(opcoesDoMotivo([motivo('SEM_RESULTADO_INEP')], null)[0].rotulo).toBe(
      'SEM_RESULTADO_INEP',
    );
  });

  it('não oferece nenhum motivo quando a fase não escolheu nenhum', () => {
    expect(opcoesDoMotivo([], null)).toEqual([]);
  });

  it('mantém, marcado, o motivo apontado que a fase deixou de escolher', () => {
    const opcoes = opcoesDoMotivo([motivo('OUTRO', 'Outro motivo.')], 'SEM_RESULTADO_INEP');

    expect(opcoes[1]).toEqual({
      codigo: 'SEM_RESULTADO_INEP',
      rotulo: 'SEM_RESULTADO_INEP',
      escolhidoPelaFase: false,
    });
  });

  it('não repete o motivo apontado que a fase ainda escolhe', () => {
    expect(opcoesDoMotivo([motivo('OUTRO')], 'OUTRO')).toHaveLength(1);
  });
});
