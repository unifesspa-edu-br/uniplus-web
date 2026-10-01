import { describe, expect, it } from 'vitest';

import type {
  CriterioDesempateConfigurado,
  ReferenciaTemporalConfig,
} from '../../processo-seletivo.models';
import {
  desempatePorIdadeSemApuracao,
  PASSO_DESEMPATE,
  PASSO_FORMULARIO,
} from './desempate-por-idade';

function criterio(regraCodigo: string): CriterioDesempateConfigurado {
  return {
    regraCodigo,
    regraVersao: '',
    etapaRef: '',
    idadeMinima: '',
    fato: '',
    operador: '',
    valor: '',
    areas: [],
  };
}

const SEM_APURACAO: ReferenciaTemporalConfig = { tipo: '', data: '', faseCodigo: '' };
const FIM_INSCRICAO: ReferenciaTemporalConfig = { ...SEM_APURACAO, tipo: 'FIM_INSCRICAO' };

describe('desempatePorIdadeSemApuracao', () => {
  it('acusa o desempate por maior idade quando o formulário não apura a idade', () => {
    expect(desempatePorIdadeSemApuracao([criterio('DESEMPATE-MAIOR-IDADE')], SEM_APURACAO)).toBe(
      true,
    );
  });

  it('não acusa quando a idade é apurada', () => {
    expect(desempatePorIdadeSemApuracao([criterio('DESEMPATE-MAIOR-IDADE')], FIM_INSCRICAO)).toBe(
      false,
    );
  });

  it('não acusa sem o critério de maior idade', () => {
    expect(desempatePorIdadeSemApuracao([criterio('DESEMPATE-OUTRO')], SEM_APURACAO)).toBe(false);
    expect(desempatePorIdadeSemApuracao([], SEM_APURACAO)).toBe(false);
  });

  it('resolve os passos pela ordem única dos passos', () => {
    expect(PASSO_DESEMPATE).toBeGreaterThanOrEqual(0);
    expect(PASSO_FORMULARIO).toBeGreaterThan(PASSO_DESEMPATE);
  });
});
