import { EtapaDaVersao } from '@uniplus/shared-data/autorizacao';
import { describe, expect, it } from 'vitest';
import {
  decidiveisDaEtapa,
  desfechoDaDecisao,
  etapasDaDecisao,
  pendentesDaEtapa,
} from './concessoes-da-etapa';
import { ETAPA, concessao } from './reclassificacao.testing';

const BETINA = concessao();
const DIOGO = concessao({ concessaoId: 'c2', beneficiarioNome: 'Diogo Teste', ehDoLeitor: true });
const DECIDIDA = concessao({
  concessaoId: 'c3',
  etapasDecididas: [ETAPA.GESTAO_DE_ACESSOS],
});
const OUTRA_ETAPA = concessao({
  concessaoId: 'c4',
  etapasExigidas: [ETAPA.PROTECAO_DE_DADOS],
});
const TODAS = [BETINA, DIOGO, DECIDIDA, OUTRA_ETAPA];

describe('concessões da etapa', () => {
  it('as pendentes exigem a etapa e ainda não a decidiram', () => {
    expect(
      pendentesDaEtapa(TODAS, EtapaDaVersao.GESTAO_DE_ACESSOS).map((c) => c.concessaoId),
    ).toEqual(['c1', 'c2']);
    expect(
      pendentesDaEtapa(TODAS, EtapaDaVersao.PROTECAO_DE_DADOS).map((c) => c.concessaoId),
    ).toEqual(['c4']);
  });

  it('as decidíveis deixam de fora a concessão da própria pessoa', () => {
    expect(
      decidiveisDaEtapa(TODAS, EtapaDaVersao.GESTAO_DE_ACESSOS).map((c) => c.concessaoId),
    ).toEqual(['c1']);
  });

  it('o desfecho traz as concessões como a leitura as tem e conta as que ela não tem', () => {
    const sem_nome = concessao({ concessaoId: 'c4', beneficiarioNome: null });
    const desfecho = desfechoDaDecisao(
      {
        loteId: 'l1',
        decididas: ['c1'],
        liberadas: ['c1'],
        paraOutraPessoa: ['c2', 'c8'],
        puladasPorEscopo: ['c9', 'c4'],
      },
      [BETINA, DIOGO, sem_nome],
    );

    expect(desfecho).toEqual({
      decididas: 1,
      liberadas: 1,
      paraOutraPessoa: [DIOGO],
      puladasPorEscopo: [sem_nome],
      ausentes: 2,
    });
  });

  it('as etapas da pessoa trazem o rótulo da API e deixam de fora a que nenhuma concessão traz', () => {
    const exigida = { ...ETAPA.GESTAO_DE_ACESSOS, rotulo: 'Etapa de gestão' };
    const concessoes = [concessao({ etapasExigidas: [exigida] })];

    expect(
      etapasDaDecisao(concessoes, [
        EtapaDaVersao.GESTAO_DE_ACESSOS,
        EtapaDaVersao.PROTECAO_DE_DADOS,
      ]),
    ).toEqual([{ codigo: EtapaDaVersao.GESTAO_DE_ACESSOS, rotulo: 'Etapa de gestão' }]);
  });

  it('a etapa já decidida pela concessão também ganha o rótulo da API', () => {
    const decidida = { ...ETAPA.PROTECAO_DE_DADOS, rotulo: 'Etapa de proteção' };
    const concessoes = [concessao({ etapasDecididas: [decidida] })];

    expect(etapasDaDecisao(concessoes, [EtapaDaVersao.PROTECAO_DE_DADOS])).toEqual([
      { codigo: EtapaDaVersao.PROTECAO_DE_DADOS, rotulo: 'Etapa de proteção' },
    ]);
  });
});
