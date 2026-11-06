import type { DiaNaoUtilDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import type { CelulaCalendarioMensal } from './calendario-mensal.util';
import { DIA_ESTADUAL, DIA_MUNICIPAL } from './calendario-dias-uteis.testing';
import {
  abrangenciaLegivel,
  municipioLegivel,
  rotuloDoDia,
  rotuloDoDiaSemOcorrencia,
  textoDaPrevia,
  ufLegivel,
} from './dia-nao-util-legivel';

const celula = (...ocorrencias: unknown[]): CelulaCalendarioMensal => ({
  data: '2026-04-05',
  dia: 5,
  ocorrencias: ocorrencias as DiaNaoUtilDto[],
});

describe('apresentação do dia não útil', () => {
  it('nomeia a abrangência e devolve o token desconhecido como veio', () => {
    expect(abrangenciaLegivel('MUNICIPAL')).toBe('Municipal');
    expect(abrangenciaLegivel('OUTRA')).toBe('OUTRA');
  });

  it('mostra a UF por extenso e a sigla, ou o que veio quando não a conhece', () => {
    expect(ufLegivel('PA')).toBe('Pará — PA');
    expect(ufLegivel('ZZ')).toBe('ZZ');
    expect(ufLegivel(null)).toBe('');
  });

  it('o município legível omite o que o registro anterior ao snapshot não tem', () => {
    expect(municipioLegivel(DIA_MUNICIPAL as unknown as DiaNaoUtilDto)).toBe('Marabá — PA');
    expect(
      municipioLegivel({ ...DIA_MUNICIPAL, municipioNome: null, municipioUf: null } as never),
    ).toBe('');
  });

  it('o nome acessível do dia traz a data, e as ocorrências quando há', () => {
    expect(rotuloDoDia(celula(DIA_MUNICIPAL))).toBe(
      '5 de abril de 2026: Aniversário de Marabá (Municipal)',
    );
    expect(rotuloDoDia(celula(DIA_MUNICIPAL, DIA_ESTADUAL))).toBe(
      '5 de abril de 2026: 2 ocorrências — Aniversário de Marabá (Municipal), Adesão do Grão-Pará à Independência (Estadual)',
    );
    expect(rotuloDoDiaSemOcorrencia(celula())).toBe(
      '5 de abril de 2026: sem dia não útil cadastrado',
    );
  });

  it('a prévia resume a ocorrência única ou conta as várias', () => {
    expect(textoDaPrevia(celula(DIA_MUNICIPAL))).toBe('Aniversário de Marabá — Municipal');
    expect(textoDaPrevia(celula(DIA_MUNICIPAL, DIA_ESTADUAL))).toBe('2 ocorrências nesta data');
  });
});
