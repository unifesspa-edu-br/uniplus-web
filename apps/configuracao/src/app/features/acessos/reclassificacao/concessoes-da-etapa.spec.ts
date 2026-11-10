import { describe, expect, it } from 'vitest';
import {
  PESSOA_SEM_NOME,
  decidiveisDaEtapa,
  desfechoDaDecisao,
  pendentesDaEtapa,
} from './concessoes-da-etapa';
import { concessao } from './reclassificacao.testing';

const BETINA = concessao();
const DIOGO = concessao({ concessaoId: 'c2', beneficiarioNome: 'Diogo Teste', ehDoLeitor: true });
const DECIDIDA = concessao({ concessaoId: 'c3', etapasDecididas: ['gestao_de_acessos'] });
const OUTRA_ETAPA = concessao({ concessaoId: 'c4', etapasExigidas: ['protecao_de_dados'] });
const TODAS = [BETINA, DIOGO, DECIDIDA, OUTRA_ETAPA];

describe('concessões da etapa', () => {
  it('as pendentes exigem a etapa e ainda não a decidiram', () => {
    expect(pendentesDaEtapa(TODAS, 'gestao_de_acessos').map((c) => c.concessaoId)).toEqual([
      'c1',
      'c2',
    ]);
    expect(pendentesDaEtapa(TODAS, 'protecao_de_dados').map((c) => c.concessaoId)).toEqual(['c4']);
  });

  it('as decidíveis deixam de fora a concessão da própria pessoa', () => {
    expect(decidiveisDaEtapa(TODAS, 'gestao_de_acessos').map((c) => c.concessaoId)).toEqual(['c1']);
  });

  it('o desfecho nomeia as concessões que ficaram para outra pessoa e as puladas por escopo', () => {
    const desfecho = desfechoDaDecisao(
      {
        loteId: 'l1',
        decididas: ['c1'],
        liberadas: ['c1'],
        paraOutraPessoa: ['c2'],
        puladasPorEscopo: ['c9', 'c4'],
      },
      [BETINA, DIOGO, concessao({ concessaoId: 'c4', beneficiarioNome: null })],
    );

    expect(desfecho).toEqual({
      decididas: 1,
      liberadas: 1,
      paraOutraPessoa: ['Diogo Teste'],
      puladasPorEscopo: [PESSOA_SEM_NOME, PESSOA_SEM_NOME],
    });
  });
});
