import {
  AreaDoEnemDoProcedimento,
  TipoDeDecisaoDoDocumento as Tipo,
  type DocumentoDaConfiguracaoProcedimentoDeRecurso,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { impedimentoDaDeclaracao, mesmoAlvo } from './unicidade-dos-procedimentos';

const ITEM = { itemDeAvaliacaoChave: 'argumentacao' };
const AREA = { areaDoEnem: AreaDoEnemDoProcedimento.REDACAO };
const inteiro = { tipoDeDecisao: Tipo.NOTA_DA_ETAPA, alvo: null };
const doItem = { ...inteiro, alvo: ITEM };
const daArea = { ...inteiro, alvo: AREA };

function procedimento(
  parcial: Partial<DocumentoDaConfiguracaoProcedimentoDeRecurso> = {},
): DocumentoDaConfiguracaoProcedimentoDeRecurso {
  return {
    tipoDeDecisao: Tipo.NOTA_DA_ETAPA,
    regra: { codigo: 'REGRA', versao: 'v1' },
    ...parcial,
  };
}

describe('unicidade dentro da janela', () => {
  it('identifica repetição sem alvo e com alvo independentemente da regra', () => {
    expect(impedimentoDaDeclaracao([procedimento()], inteiro)).toBe('duplicado');
    expect(impedimentoDaDeclaracao([procedimento({ alvo: ITEM })], doItem)).toBe('duplicado');
    expect(impedimentoDaDeclaracao([procedimento({ alvo: AREA })], daArea)).toBe('duplicado');
    expect(impedimentoDaDeclaracao([procedimento({ alvo: {} })], inteiro)).toBe('duplicado');
  });

  it('recusa a mistura de alvo e decisão inteira nos dois sentidos', () => {
    expect(impedimentoDaDeclaracao([procedimento()], doItem)).toBe('conflitante');
    expect(impedimentoDaDeclaracao([procedimento({ alvo: AREA })], inteiro)).toBe('conflitante');
  });

  it('permite alvos diferentes e tipos diferentes sem modificar a entrada', () => {
    const lista = Object.freeze([Object.freeze(procedimento({ alvo: ITEM }))]);
    expect(impedimentoDaDeclaracao(lista, daArea)).toBeNull();
    expect(
      impedimentoDaDeclaracao(lista, { ...doItem, alvo: { itemDeAvaliacaoChave: 'coesao' } }),
    ).toBeNull();
    expect(
      impedimentoDaDeclaracao(lista, { ...inteiro, tipoDeDecisao: Tipo.CLASSIFICACAO }),
    ).toBeNull();
    expect(lista).toEqual([procedimento({ alvo: ITEM })]);
  });

  it('não confunde os produtores: uma janela vazia admite o que outra já declarou', () => {
    expect(impedimentoDaDeclaracao([procedimento({ alvo: ITEM })], doItem)).toBe('duplicado');
    expect(impedimentoDaDeclaracao([], doItem)).toBeNull();
  });

  it('confere toda a lista importada mesmo quando o primeiro procedimento não conflita', () => {
    const lista = [procedimento({ alvo: AREA }), procedimento()];
    expect(impedimentoDaDeclaracao(lista, doItem)).toBe('conflitante');
    expect(impedimentoDaDeclaracao(lista, inteiro)).toBe('duplicado');
  });

  it('distingue itens, áreas e ausência sem usar rótulo ou posição', () => {
    expect(mesmoAlvo(ITEM, { itemDeAvaliacaoChave: 'coesao' })).toBe(false);
    expect(mesmoAlvo(AREA, ITEM)).toBe(false);
    expect(mesmoAlvo(AREA, { areaDoEnem: AreaDoEnemDoProcedimento.MATEMATICA })).toBe(false);
    expect(mesmoAlvo(undefined, {})).toBe(true);
    expect(mesmoAlvo(null, ITEM)).toBe(false);
  });
});
