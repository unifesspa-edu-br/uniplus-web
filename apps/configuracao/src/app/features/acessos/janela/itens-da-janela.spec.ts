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
const RETIDA = itemDaJanela({ concessaoId: 'c4', situacao: 'retida' });
const NA_PROTECAO = itemDaJanela({
  concessaoId: 'c5',
  situacao: 'aguardando_protecao_de_dados',
  exigeProtecaoDeDados: true,
});
const MIGRADA = itemDaJanela({ concessaoId: 'c6', situacao: 'migrada' });

describe('separarItens', () => {
  it('separa o que a pessoa que lê decide, o que é dela e o que já tem situação final', () => {
    const janela = janelaDeMigracao({
      itens: [BETINA, LEANDRO, PROPRIA, RETIDA, NA_PROTECAO, MIGRADA],
    });

    const itens = separarItens(janela);

    expect(itens.doLote).toEqual([BETINA, LEANDRO]);
    expect(itens.proprias).toEqual([PROPRIA]);
    expect(itens.retidas).toEqual([RETIDA]);
    expect(itens.naProtecaoDeDados).toEqual([NA_PROTECAO]);
    expect(itens.decididas).toEqual([MIGRADA]);
  });

  it('a concessão própria que aguarda a proteção de dados também fica sem ação', () => {
    const propria = itemDaJanela({
      concessaoId: 'c7',
      situacao: 'aguardando_protecao_de_dados',
      ehDoLeitor: true,
    });

    expect(separarItens(janelaDeMigracao({ itens: [propria] })).proprias).toEqual([propria]);
  });

  it.each(['encerrando', 'encerrada'])(
    'com a janela %s nada aceita decisão e tudo aparece como situação',
    (situacao) => {
      const janela = janelaDeMigracao({ situacao, itens: [BETINA, RETIDA, NA_PROTECAO] });

      const itens = separarItens(janela);

      expect(itens.decididas).toEqual([BETINA, RETIDA, NA_PROTECAO]);
      expect(itens.doLote).toHaveLength(0);
      expect(janelaAceitaDecisao(janela)).toBe(false);
    },
  );
});

describe('decisões da migração', () => {
  const decisoes = new Map([
    ['c1', 'migrar' as const],
    ['c2', 'recusar' as const],
    ['fora', 'recusar' as const],
  ]);

  it('conta as concessões sem decisão e as recusas', () => {
    expect(semDecisao([BETINA, LEANDRO, PROPRIA], decisoes)).toBe(1);
    expect(quantidadeDeRecusas(decisoes)).toBe(2);
  });

  it('envia só as decisões das concessões da etapa, na ordem da lista', () => {
    expect(decisoesDaEtapa([LEANDRO, BETINA, PROPRIA], decisoes)).toEqual([
      { concessaoId: 'c2', decisao: 'recusar' },
      { concessaoId: 'c1', decisao: 'migrar' },
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
