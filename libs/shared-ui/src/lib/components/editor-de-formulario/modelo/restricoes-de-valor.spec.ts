import { describe, expect, it } from 'vitest';

import { fato, item } from './conteudos-de-exemplo.testing';
import {
  fontesDasOpcoes,
  opcoesDaFonteCabemNoAlvo,
  restricoesParaAcrescentar,
} from './restricoes-de-valor';
import type { FatoDoFormulario } from './tipos';

describe('restricoesParaAcrescentar', () => {
  it('oferece só a restrição que cabe no tipo do campo, uma por tipo', () => {
    const numero = item('IDADE', 0, 'S1', { apresentacao: { tipoRenderizacao: 'NUMERO' } });
    const selecao = item('COR', 0, 'S1', { apresentacao: { tipoRenderizacao: 'SELECAO_UNICA' } });

    expect(restricoesParaAcrescentar(numero, false).map((r) => r.valor)).toEqual([
      'FAIXA_NUMERICA',
    ]);
    expect(
      restricoesParaAcrescentar(
        {
          ...numero,
          regras: { ...numero.regras, restricoes: [{ tipo: 'FAIXA_NUMERICA', minimo: 0 }] },
        },
        false,
      ),
    ).toEqual([]);
    expect(
      restricoesParaAcrescentar(selecao, false),
      'sem valores conhecidos não há o que marcar',
    ).toEqual([]);
    expect(restricoesParaAcrescentar(selecao, true).map((r) => r.valor)).toEqual([
      'OPCOES_PERMITIDAS',
    ]);
  });

  it('oferece as opções das respostas anteriores na seleção só quando há campo anterior de onde elas venham', () => {
    const selecao = item('LISTA_DE_ESPERA', 1, 'S1', {
      apresentacao: { tipoRenderizacao: 'SELECAO_UNICA' },
    });

    expect(restricoesParaAcrescentar(selecao, false, false)).toEqual([]);
    expect(restricoesParaAcrescentar(selecao, false, true).map((r) => r.valor)).toEqual([
      'OPCOES_DAS_RESPOSTAS',
    ]);
  });
});

describe('de onde vêm as opções formadas pelas respostas', () => {
  const curso = (
    codigo: string,
    valores: readonly string[] | null,
    extra: Partial<FatoDoFormulario> = {},
  ): FatoDoFormulario =>
    fato(codigo, {
      dominio: 'CATEGORICO',
      cardinalidade: 'MULTIVALORADO',
      fonteValores: 'GLOBAL',
      valoresDominio: valores,
      ...extra,
    });

  it.each([
    [
      'os valores da fonte estão entre os do alvo',
      true,
      curso('ESPERA', ['MED', 'DIR', 'ENG']),
      curso('OPCOES', ['MED', 'DIR']),
    ],
    [
      'a fonte tem valor que o alvo não oferece',
      false,
      curso('ESPERA', ['MED']),
      curso('OPCOES', ['MED', 'DIR']),
    ],
    [
      'o domínio é outro',
      false,
      curso('ESPERA', ['MED']),
      curso('OPCOES', ['MED'], { dominio: 'TEXTO' }),
    ],
    [
      'nenhum enumera e a fonte dos valores é a mesma',
      true,
      curso('ESPERA', null, { fonteValores: 'PROCESSO' }),
      curso('OPCOES', null, { fonteValores: 'PROCESSO' }),
    ],
    [
      'nenhum enumera e a fonte dos valores é outra',
      false,
      curso('ESPERA', null, { fonteValores: 'PROCESSO' }),
      curso('OPCOES', null, { fonteValores: 'GEO_UF' }),
    ],
    [
      'só um enumera',
      false,
      curso('ESPERA', ['MED']),
      curso('OPCOES', null, { fonteValores: 'PROCESSO' }),
    ],
  ])('%s: cabe = %s', (_caso, cabe, alvo, fonte) => {
    expect(opcoesDaFonteCabemNoAlvo(alvo, fonte)).toBe(cabe);
  });

  it('o domínio do processo, quando conhecido, conta como os valores enumerados', () => {
    const alvo = curso('ESPERA', null, { fonteValores: 'PROCESSO' });
    const fonte = curso('OPCOES', null, { fonteValores: 'PROCESSO' });

    expect(
      opcoesDaFonteCabemNoAlvo(
        alvo,
        fonte,
        new Map([
          ['ESPERA', ['MED']],
          ['OPCOES', ['MED', 'DIR']],
        ]),
      ),
    ).toBe(false);
  });

  it('oferece só os citáveis pelo campo cujas opções cabem nas dele, nunca o próprio', () => {
    const catalogo = [
      curso('ESPERA', ['MED', 'DIR']),
      curso('OPCOES', ['MED']),
      curso('POSTERIOR', ['MED']),
      curso('OUTRO_DOMINIO', ['XYZ']),
    ];

    const fontes = fontesDasOpcoes(
      catalogo,
      new Set(['OPCOES', 'OUTRO_DOMINIO', 'ESPERA']),
      'ESPERA',
    );

    expect(fontes.map((fonte) => fonte.codigo)).toEqual(['OPCOES']);
  });
});
