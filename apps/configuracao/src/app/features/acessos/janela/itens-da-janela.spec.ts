import {
  SituacaoDaConcessaoNaRevisaoCodigo,
  SituacaoDaRevisaoDasConcessoesCodigo,
} from '@uniplus/shared-data/autorizacao';
import { ResultadoDaMigracao } from '@uniplus/shared-data/autorizacao';
import { describe, expect, it } from 'vitest';
import {
  decisoesDaEtapa,
  janelaAceitaDecisao,
  quantidadeDeRecusas,
  semDecisao,
  separarItens,
  tempoRestante,
} from './itens-da-janela';
import { itemDaJanela, janelaDeMigracao } from './janela.testing';

const BETINA = itemDaJanela({ concessaoId: 'c1', beneficiarioNome: 'Betina Teste' });
const LEANDRO = itemDaJanela({ concessaoId: 'c2', beneficiarioNome: 'Leandro Teste' });
const PROPRIA = itemDaJanela({ concessaoId: 'c3', ehDoLeitor: true });
const RETIDA = itemDaJanela({
  concessaoId: 'c4',
  situacao: { codigo: SituacaoDaConcessaoNaRevisaoCodigo.RETIDA, rotulo: 'Outro rótulo' },
});
const NA_PROTECAO = itemDaJanela({
  concessaoId: 'c5',
  situacao: {
    codigo: SituacaoDaConcessaoNaRevisaoCodigo.AGUARDANDO_PROTECAO_DE_DADOS,
    rotulo: 'Aguarda o Representante do controlador',
  },
  exigeProtecaoDeDados: true,
});
const MIGRADA = itemDaJanela({
  concessaoId: 'c6',
  situacao: { codigo: SituacaoDaConcessaoNaRevisaoCodigo.MIGRADA, rotulo: 'Aprovada' },
});

describe('separarItens', () => {
  it('separa o que a pessoa que lê decide, o que é dela e o que já tem situação final', () => {
    const revisao = janelaDeMigracao({
      itens: [BETINA, LEANDRO, PROPRIA, RETIDA, NA_PROTECAO, MIGRADA],
    });

    const itens = separarItens(revisao);

    expect(itens.aguardandoDecisao).toEqual([BETINA, LEANDRO]);
    expect(itens.proprias).toEqual([PROPRIA]);
    expect(itens.retidas).toEqual([RETIDA]);
    expect(itens.naProtecaoDeDados).toEqual([NA_PROTECAO]);
    expect(itens.decididas).toEqual([MIGRADA]);
  });

  it('a concessão própria que aguarda a proteção de dados também fica sem ação', () => {
    const propria = itemDaJanela({
      concessaoId: 'c7',
      situacao: {
        codigo: SituacaoDaConcessaoNaRevisaoCodigo.AGUARDANDO_PROTECAO_DE_DADOS,
        rotulo: 'Aguarda o Representante do controlador',
      },
      ehDoLeitor: true,
    });

    expect(separarItens(janelaDeMigracao({ itens: [propria] })).proprias).toEqual([propria]);
  });

  it.each([
    SituacaoDaRevisaoDasConcessoesCodigo.ENCERRANDO,
    SituacaoDaRevisaoDasConcessoesCodigo.ENCERRADA,
  ])(
    'com a revisão das concessões %s nada aceita decisão e tudo aparece como situação',
    (situacao) => {
      const revisao = janelaDeMigracao({
        situacao: { codigo: situacao, rotulo: 'Outro rótulo' },
        itens: [BETINA, RETIDA, NA_PROTECAO],
      });

      const itens = separarItens(revisao);

      expect(itens.decididas).toEqual([BETINA, RETIDA, NA_PROTECAO]);
      expect(itens.aguardandoDecisao).toHaveLength(0);
      expect(janelaAceitaDecisao(revisao)).toBe(false);
    },
  );
});

describe('decisões da migração', () => {
  const decisoes = new Map([
    ['c1', ResultadoDaMigracao.MIGRAR],
    ['c2', ResultadoDaMigracao.RECUSAR],
    ['fora', ResultadoDaMigracao.RECUSAR],
  ]);

  it('conta as concessões sem decisão e as recusas', () => {
    expect(semDecisao([BETINA, LEANDRO, PROPRIA], decisoes)).toBe(1);
    expect(quantidadeDeRecusas(decisoes)).toBe(2);
  });

  it('envia só as decisões das concessões da etapa, na ordem da lista', () => {
    expect(decisoesDaEtapa([LEANDRO, BETINA, PROPRIA], decisoes)).toEqual([
      { concessaoId: 'c2', decisao: ResultadoDaMigracao.RECUSAR },
      { concessaoId: 'c1', decisao: ResultadoDaMigracao.MIGRAR },
    ]);
  });
});

describe('tempoRestante', () => {
  const prazo = '2026-11-12T12:00:00Z';
  const em = (iso: string): number => Date.parse(iso);

  it('diz as horas e os minutos que faltam', () => {
    expect(tempoRestante(prazo, em('2026-11-10T10:30:00Z'))).toBe('49 h 30 min');
  });

  it('abaixo de uma hora, diz só os minutos', () => {
    expect(tempoRestante(prazo, em('2026-11-12T11:15:00Z'))).toBe('45 min');
  });

  it('arredonda o minuto incompleto para cima', () => {
    expect(tempoRestante(prazo, em('2026-11-12T11:59:30Z'))).toBe('1 min');
  });

  it('não diz nada quando o prazo passou', () => {
    expect(tempoRestante(prazo, em('2026-11-12T12:00:00Z'))).toBeNull();
    expect(tempoRestante('data inválida', em('2026-11-10T10:30:00Z'))).toBeNull();
  });
});
