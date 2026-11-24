import { describe, expect, it } from 'vitest';

import { item } from './conteudos-de-exemplo.testing';
import { problemaDaRestricao, problemaDoLimiteDeData } from './problemas-da-restricao';
import { limiteDeDataNovo, restricaoNova, restricoesParaAcrescentar } from './restricoes-de-valor';

describe('faixa de datas', () => {
  const dataFixa = (data: string | null) => ({ ancora: 'DATA_FIXA', data });
  const doEnvio = (anos: number | string, dias: number | string) => ({
    ancora: 'ENVIO',
    anos,
    dias,
  });

  it('é oferecida só no campo de data, uma por tipo', () => {
    const data = item('NASCIMENTO', 0, 'S1', { apresentacao: { tipoRenderizacao: 'DATA' } });

    expect(restricoesParaAcrescentar(data, false).map((r) => r.valor)).toEqual(['FAIXA_DE_DATA']);
    expect(
      restricoesParaAcrescentar(
        { ...data, regras: { ...data.regras, restricoes: [restricaoNova('FAIXA_DE_DATA')] } },
        false,
      ),
    ).toEqual([]);
    for (const tipo of ['NUMERO', 'TEXTO', 'SIM_OU_NAO', 'ESCOLHA_UNICA']) {
      expect(
        restricoesParaAcrescentar(
          item('X', 0, 'S1', { apresentacao: { tipoRenderizacao: tipo } }),
          true,
          true,
        ).map((r) => r.valor),
      ).not.toContain('FAIXA_DE_DATA');
    }
  });

  it('nasce sem limite, e o limite novo nasce na referência escolhida', () => {
    expect(restricaoNova('FAIXA_DE_DATA')).toEqual({
      tipo: 'FAIXA_DE_DATA',
      dataMinima: null,
      dataMaxima: null,
    });
    expect(limiteDeDataNovo('DATA_FIXA')).toEqual({ ancora: 'DATA_FIXA', data: null });
    expect(limiteDeDataNovo('ENVIO')).toEqual({ ancora: 'ENVIO', anos: 0, dias: 0 });
  });

  it.each([
    [{ tipo: 'FAIXA_DE_DATA', dataMinima: null, dataMaxima: null }, 'Informe ao menos um limite.'],
    [
      {
        tipo: 'FAIXA_DE_DATA',
        dataMinima: dataFixa('2030-01-02'),
        dataMaxima: dataFixa('2030-01-01'),
      },
      'A data mínima fica depois da data máxima.',
    ],
    [
      { tipo: 'FAIXA_DE_DATA', dataMinima: doEnvio(0, 1), dataMaxima: doEnvio(0, -1) },
      'A data mínima fica depois da data máxima.',
    ],
    [
      { tipo: 'FAIXA_DE_DATA', dataMinima: doEnvio(1, 0), dataMaxima: doEnvio(0, 0) },
      'A data mínima fica depois da data máxima.',
    ],
  ])('a faixa %o é recusada antes de ir à API', (restricao, problema) => {
    expect(problemaDaRestricao(restricao)).toBe(problema);
  });

  it('aceita um limite só, a ordem que depende do dia do envio e datas iguais', () => {
    expect(
      problemaDaRestricao({ tipo: 'FAIXA_DE_DATA', dataMinima: null, dataMaxima: doEnvio(0, 0) }),
    ).toBeNull();
    expect(
      problemaDaRestricao({
        tipo: 'FAIXA_DE_DATA',
        dataMinima: dataFixa('2030-01-01'),
        dataMaxima: doEnvio(0, 0),
      }),
    ).toBeNull();
    expect(
      problemaDaRestricao({
        tipo: 'FAIXA_DE_DATA',
        dataMinima: doEnvio(-120, 0),
        dataMaxima: doEnvio(0, 0),
      }),
    ).toBeNull();
    expect(
      problemaDaRestricao({
        tipo: 'FAIXA_DE_DATA',
        dataMinima: dataFixa('2030-01-01'),
        dataMaxima: dataFixa('2030-01-01'),
      }),
    ).toBeNull();
  });

  it.each([
    [dataFixa(null), 'Informe a data.'],
    [dataFixa('2030-02-30'), 'Use uma data do calendário, no formato dia/mês/ano.'],
    [dataFixa('0001-01-01'), 'A data não pode ser 01/01/0001.'],
    [doEnvio('abc', 0), 'Os anos e os dias são números inteiros.'],
    [doEnvio(1.5, 0), 'Os anos e os dias são números inteiros.'],
    [doEnvio(151, 0), 'O deslocamento vai até 150 anos ou 54900 dias, para mais ou para menos.'],
    [doEnvio(0, -54901), 'O deslocamento vai até 150 anos ou 54900 dias, para mais ou para menos.'],
  ])('o limite %o diz o que o impede', (limite, problema) => {
    expect(problemaDoLimiteDeData(limite)).toBe(problema);
  });

  it('aceita a data fixa do calendário e o deslocamento dentro do teto, para os dois lados', () => {
    expect(problemaDoLimiteDeData(dataFixa('2028-02-29'))).toBeNull();
    expect(problemaDoLimiteDeData(doEnvio(-150, 0))).toBeNull();
    expect(problemaDoLimiteDeData(doEnvio(0, 54900))).toBeNull();
    expect(problemaDoLimiteDeData(null)).toBeNull();
  });
});
