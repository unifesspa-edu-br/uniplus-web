import { describe, expect, it } from 'vitest';

import { CriterioDesempateConfigurado } from '../../processo-seletivo.models';
import {
  comoComandoDeCriterioDesempate,
  comoComandoDeCriteriosDesempate,
  desempateUsaEtapa,
  desempateUsaIdadeMinima,
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
    ...patch,
  };
}

describe('shape por código de regra de desempate (ArgsCriterioDesempate)', () => {
  it('DESEMPATE-MAIOR-NOTA-ETAPA usa só etapaRef', () => {
    expect(desempateUsaEtapa('DESEMPATE-MAIOR-NOTA-ETAPA')).toBe(true);

    const comando = comoComandoDeCriterioDesempate(
      criterio({
        regraCodigo: 'DESEMPATE-MAIOR-NOTA-ETAPA',
        regraVersao: '1.0',
        etapaRef: 'etapa-1',
        idadeMinima: '60', // resíduo — não pode vazar
      }),
      1,
    );

    expect(comando).toEqual({
      ordem: 1,
      regraCodigo: 'DESEMPATE-MAIOR-NOTA-ETAPA',
      regraVersao: '1.0',
      etapaRef: 'etapa-1',
      idadeMinima: null,
      fato: null,
      operador: null,
      valor: null,
    });
  });

  it('DESEMPATE-MAIOR-IDADE não usa nenhum argumento', () => {
    const comando = comoComandoDeCriterioDesempate(
      criterio({ regraCodigo: 'DESEMPATE-MAIOR-IDADE', regraVersao: '1.0', idadeMinima: '60' }),
      2,
    );

    expect(comando).toEqual({
      ordem: 2,
      regraCodigo: 'DESEMPATE-MAIOR-IDADE',
      regraVersao: '1.0',
      etapaRef: null,
      idadeMinima: null,
      fato: null,
      operador: null,
      valor: null,
    });
  });

  it('DESEMPATE-IDOSO usa só idadeMinima', () => {
    expect(desempateUsaIdadeMinima('DESEMPATE-IDOSO')).toBe(true);

    const comando = comoComandoDeCriterioDesempate(
      criterio({ regraCodigo: 'DESEMPATE-IDOSO', regraVersao: '1.0', idadeMinima: '60' }),
      1,
    );

    expect(comando.idadeMinima).toBe(60);
    expect(comando.etapaRef).toBeNull();
  });

  it('DESEMPATE-PREDICADO-FATO usa fato, operador e valor', () => {
    expect(desempateUsaPredicadoFato('DESEMPATE-PREDICADO-FATO')).toBe(true);

    const comando = comoComandoDeCriterioDesempate(
      criterio({
        regraCodigo: 'DESEMPATE-PREDICADO-FATO',
        regraVersao: '1.0',
        fato: 'RENDA_PER_CAPITA',
        operador: 'lte',
        valor: '1.5',
      }),
      1,
    );

    expect(comando).toEqual({
      ordem: 1,
      regraCodigo: 'DESEMPATE-PREDICADO-FATO',
      regraVersao: '1.0',
      etapaRef: null,
      idadeMinima: null,
      fato: 'RENDA_PER_CAPITA',
      operador: 'lte',
      valor: '1.5',
    });
  });
});

describe('comoComandoDeCriteriosDesempate', () => {
  it('atribui a ordem pela posição no array, 1-based', () => {
    const comando = comoComandoDeCriteriosDesempate([
      criterio({ regraCodigo: 'DESEMPATE-MAIOR-IDADE', regraVersao: '1.0' }),
      criterio({ regraCodigo: 'DESEMPATE-IDOSO', regraVersao: '1.0', idadeMinima: '60' }),
    ]);

    expect(comando.map((item) => item.ordem)).toEqual([1, 2]);
  });
});
