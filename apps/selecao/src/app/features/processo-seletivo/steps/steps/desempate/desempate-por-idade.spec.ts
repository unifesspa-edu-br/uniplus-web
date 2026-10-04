import { describe, expect, it } from 'vitest';

import type {
  CriterioDesempateConfigurado,
  ReferenciaTemporalConfig,
} from '../../processo-seletivo.models';
import {
  desempateIdosoSemApuracao,
  desempateSemDataDeNascimento,
  desempateUsaDataDeNascimento,
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

const coletados = (...fatos: string[]): ReadonlySet<string> => new Set(fatos);

const SEM_APURACAO: ReferenciaTemporalConfig = { tipo: '', data: '', faseCodigo: '' };
const FIM_INSCRICAO: ReferenciaTemporalConfig = { ...SEM_APURACAO, tipo: 'FIM_INSCRICAO' };

const MAIOR_IDADE = criterio('DESEMPATE-MAIOR-IDADE');
const IDOSO = criterio('DESEMPATE-IDOSO');

describe('desempateSemDataDeNascimento', () => {
  it('acusa o maior idade quando o formulário não coleta a data de nascimento', () => {
    expect(desempateSemDataDeNascimento([MAIOR_IDADE], coletados('COR_RACA'))).toBe(true);
    expect(desempateSemDataDeNascimento([MAIOR_IDADE], coletados())).toBe(true);
  });

  it('não acusa quando a data de nascimento é coletada', () => {
    expect(desempateSemDataDeNascimento([MAIOR_IDADE], coletados('DATA_NASCIMENTO'))).toBe(false);
  });

  it('não acusa sem o critério de maior idade', () => {
    expect(desempateSemDataDeNascimento([criterio('DESEMPATE-OUTRO')], coletados())).toBe(false);
    expect(desempateSemDataDeNascimento([], coletados())).toBe(false);
  });

  it('não depende da apuração da idade: o maior idade compara datas de nascimento', () => {
    expect(desempateUsaDataDeNascimento([MAIOR_IDADE])).toBe(true);
    expect(desempateUsaDataDeNascimento([IDOSO])).toBe(false);
  });
});

describe('desempateIdosoSemApuracao', () => {
  it('acusa o idoso quando o formulário não apura a idade', () => {
    expect(desempateIdosoSemApuracao([IDOSO], SEM_APURACAO)).toBe(true);
  });

  it('não acusa quando a idade é apurada', () => {
    expect(desempateIdosoSemApuracao([IDOSO], FIM_INSCRICAO)).toBe(false);
  });

  it('não acusa o maior idade, que não usa a faixa etária', () => {
    expect(desempateIdosoSemApuracao([MAIOR_IDADE], SEM_APURACAO)).toBe(false);
    expect(desempateIdosoSemApuracao([], SEM_APURACAO)).toBe(false);
  });
});
