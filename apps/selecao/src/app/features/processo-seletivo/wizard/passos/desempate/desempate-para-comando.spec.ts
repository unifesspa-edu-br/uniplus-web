import { OperadorCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { CriterioDesempateConfigurado } from '../../processo-seletivo.models';
import {
  comoComandoDeCriterioDesempate,
  comoComandoDeCriteriosDesempate,
  desempateUsaEtapa,
  desempateUsaIdadeMinima,
  desempateTemShapeConhecido,
  desempateUsaAreas,
  desempateUsaPredicadoFato,
} from './desempate-para-comando';

function criterio(patch: Partial<CriterioDesempateConfigurado>): CriterioDesempateConfigurado {
  return {
    regraCodigo: '',
    regraVersao: '',
    etapaRef: '',
    idadeMinima: '',
    fato: '',
    operador: '',
    valor: '',
    areas: [],
    ...patch,
  };
}

describe('shape por código de regra de desempate (ArgsCriterioDesempate)', () => {
  it('DESEMPATE_MAIOR_NOTA_ETAPA usa só etapaRef', () => {
    expect(desempateUsaEtapa('DESEMPATE_MAIOR_NOTA_ETAPA')).toBe(true);

    const comando = comoComandoDeCriterioDesempate(
      criterio({
        regraCodigo: 'DESEMPATE_MAIOR_NOTA_ETAPA',
        regraVersao: '1.0',
        etapaRef: 'etapa-1',
        idadeMinima: '60', // resíduo — não pode vazar
      }),
      1,
    );

    expect(comando).toEqual({
      ordem: 1,
      regra: { codigo: 'DESEMPATE_MAIOR_NOTA_ETAPA', versao: '1.0' },
      parametros: {
        etapaRef: 'etapa-1',
        idadeMinima: null,
        fato: null,
        operador: null,
        valor: null,
        areas: null,
      },
    });
  });

  it('DESEMPATE_MAIOR_IDADE não usa nenhum argumento', () => {
    const comando = comoComandoDeCriterioDesempate(
      criterio({ regraCodigo: 'DESEMPATE_MAIOR_IDADE', regraVersao: '1.0', idadeMinima: '60' }),
      2,
    );

    expect(comando).toEqual({
      ordem: 2,
      regra: { codigo: 'DESEMPATE_MAIOR_IDADE', versao: '1.0' },
      parametros: {
        etapaRef: null,
        idadeMinima: null,
        fato: null,
        operador: null,
        valor: null,
        areas: null,
      },
    });
  });

  it('DESEMPATE_IDOSO usa só idadeMinima', () => {
    expect(desempateUsaIdadeMinima('DESEMPATE_IDOSO')).toBe(true);

    const comando = comoComandoDeCriterioDesempate(
      criterio({ regraCodigo: 'DESEMPATE_IDOSO', regraVersao: '1.0', idadeMinima: '60' }),
      1,
    );

    expect(comando.parametros?.idadeMinima).toBe(60);
    expect(comando.parametros?.etapaRef).toBeNull();
  });

  it('DESEMPATE_CONDICAO_SOBRE_DADO usa fato, operador e valor', () => {
    expect(desempateUsaPredicadoFato('DESEMPATE_CONDICAO_SOBRE_DADO')).toBe(true);

    const comando = comoComandoDeCriterioDesempate(
      criterio({
        regraCodigo: 'DESEMPATE_CONDICAO_SOBRE_DADO',
        regraVersao: '1.0',
        fato: 'RENDA_PER_CAPITA',
        operador: OperadorCodigo.MENOR_IGUAL,
        valor: '1.5',
      }),
      1,
    );

    expect(comando).toEqual({
      ordem: 1,
      regra: { codigo: 'DESEMPATE_CONDICAO_SOBRE_DADO', versao: '1.0' },
      parametros: {
        etapaRef: null,
        idadeMinima: null,
        fato: 'RENDA_PER_CAPITA',
        operador: OperadorCodigo.MENOR_IGUAL,
        valor: '1.5',
        areas: null,
      },
    });
  });

  it('DESEMPATE_MAIOR_NOTA_AREA_ENEM usa só as áreas, na ordem da lista', () => {
    expect(desempateUsaAreas('DESEMPATE_MAIOR_NOTA_AREA_ENEM')).toBe(true);
    expect(desempateTemShapeConhecido('DESEMPATE_MAIOR_NOTA_AREA_ENEM')).toBe(true);

    const comando = comoComandoDeCriterioDesempate(
      criterio({
        regraCodigo: 'DESEMPATE_MAIOR_NOTA_AREA_ENEM',
        regraVersao: '1',
        areas: ['REDACAO', 'MATEMATICA'],
        idadeMinima: '60', // resíduo — não pode vazar
      }),
      1,
    );

    expect(comando).toEqual({
      ordem: 1,
      regra: { codigo: 'DESEMPATE_MAIOR_NOTA_AREA_ENEM', versao: '1' },
      parametros: {
        etapaRef: null,
        idadeMinima: null,
        fato: null,
        operador: null,
        valor: null,
        areas: ['REDACAO', 'MATEMATICA'],
      },
    });
  });

  it('as áreas não viajam em outra regra', () => {
    const comando = comoComandoDeCriterioDesempate(
      criterio({ regraCodigo: 'DESEMPATE_MAIOR_IDADE', regraVersao: '1.0', areas: ['REDACAO'] }),
      1,
    );

    expect(comando.parametros?.areas).toBeNull();
  });
});

describe('comoComandoDeCriteriosDesempate', () => {
  it('atribui a ordem pela posição no array, 1-based', () => {
    const comando = comoComandoDeCriteriosDesempate([
      criterio({ regraCodigo: 'DESEMPATE_MAIOR_IDADE', regraVersao: '1.0' }),
      criterio({ regraCodigo: 'DESEMPATE_IDOSO', regraVersao: '1.0', idadeMinima: '60' }),
    ]);

    expect(comando.map((item) => item.ordem)).toEqual([1, 2]);
  });
});
