import type { DiaNaoUtilDto } from '@uniplus/shared-data/configuracao';
import { describe, expect, it } from 'vitest';
import { ABRANGENCIAS } from './abrangencias.testing';
import { DIA_ESTADUAL, DIA_MUNICIPAL, PARAUAPEBAS } from './calendario-dias-uteis.testing';
import { DIA_EM_PARAUAPEBAS, DIA_EM_TOCANTINS, DIA_INSTITUCIONAL } from './recorte.testing';
import {
  avisoDoMunicipio,
  campoDaLocalidade,
  contagemDoRecorte,
  escolhaForaDasOpcoes,
  opcoesDeAbrangencia,
  opcoesDeLocalidade,
  visibilidadeDoRecorte,
} from './recorte-da-exibicao.util';

const DIAS = [
  DIA_INSTITUCIONAL,
  DIA_EM_PARAUAPEBAS,
  DIA_MUNICIPAL,
  DIA_ESTADUAL,
  DIA_EM_TOCANTINS,
] as unknown as DiaNaoUtilDto[];

const idsVisiveis = (abrangencia: string, localidade = ''): string[] =>
  DIAS.filter(visibilidadeDoRecorte({ abrangencia, localidade })).map((dia) => dia.id);

describe('recorte da exibição', () => {
  it('oferece cada abrangência do dataset uma vez, com o rótulo da API, na ordem do domínio', () => {
    expect(opcoesDeAbrangencia(DIAS)).toEqual([
      { value: ABRANGENCIAS.ESTADUAL.codigo, label: ABRANGENCIAS.ESTADUAL.rotulo },
      { value: ABRANGENCIAS.MUNICIPAL.codigo, label: ABRANGENCIAS.MUNICIPAL.rotulo },
      { value: ABRANGENCIAS.INSTITUCIONAL.codigo, label: ABRANGENCIAS.INSTITUCIONAL.rotulo },
    ]);
  });

  it('só a abrangência estadual e a municipal têm o segundo campo', () => {
    expect(campoDaLocalidade(ABRANGENCIAS.ESTADUAL.codigo)?.rotulo).toBe('Unidade Federativa (UF)');
    expect(campoDaLocalidade(ABRANGENCIAS.MUNICIPAL.codigo)?.rotulo).toBe('Município');
    expect(campoDaLocalidade(ABRANGENCIAS.NACIONAL.codigo)).toBeNull();
    expect(campoDaLocalidade(ABRANGENCIAS.INSTITUCIONAL.codigo)).toBeNull();
    expect(campoDaLocalidade('')).toBeNull();
  });

  it('as localidades são as do dataset na abrangência escolhida, em ordem alfabética', () => {
    expect(opcoesDeLocalidade(DIAS, ABRANGENCIAS.MUNICIPAL.codigo)).toEqual([
      { value: DIA_MUNICIPAL.municipioIbge, label: 'Marabá — PA' },
      { value: PARAUAPEBAS.codigoIbge, label: 'Parauapebas — PA' },
    ]);
    expect(opcoesDeLocalidade(DIAS, ABRANGENCIAS.ESTADUAL.codigo)).toEqual([
      { value: 'PA', label: 'Pará — PA' },
      { value: 'TO', label: 'Tocantins — TO' },
    ]);
    expect(opcoesDeLocalidade(DIAS, ABRANGENCIAS.NACIONAL.codigo)).toEqual([]);
  });

  it('sem escolha, mostra tudo; com a abrangência, só ela; com a localidade, só a dela', () => {
    expect(idsVisiveis('')).toHaveLength(DIAS.length);
    expect(idsVisiveis(ABRANGENCIAS.MUNICIPAL.codigo)).toEqual([
      DIA_EM_PARAUAPEBAS.id,
      DIA_MUNICIPAL.id,
    ]);
    expect(idsVisiveis(ABRANGENCIAS.MUNICIPAL.codigo, DIA_MUNICIPAL.municipioIbge)).toEqual([
      DIA_MUNICIPAL.id,
    ]);
    expect(idsVisiveis(ABRANGENCIAS.ESTADUAL.codigo, 'TO')).toEqual([DIA_EM_TOCANTINS.id]);
  });

  it('conta o que está à vista diante do total', () => {
    expect(contagemDoRecorte(1, 5)).toBe('Mostrando 1 de 5 dias não úteis.');
    expect(contagemDoRecorte(1, 1)).toBe('Mostrando 1 de 1 dia não útil.');
  });

  it('o aviso do município lembra o que também vale lá e está oculto', () => {
    expect(avisoDoMunicipio(DIAS, DIA_MUNICIPAL.municipioIbge)).toBe(
      'Em Marabá — PA também valem os dias nacionais, os estaduais da UF PA e os institucionais, que este filtro oculta.',
    );
    expect(avisoDoMunicipio(DIAS, '9999999')).toBe('');
  });

  it('a escolha sem opção nos dias carregados está fora das opções; sem escolha, nunca', () => {
    const escolha = (abrangencia: string, localidade = '') => ({ abrangencia, localidade });

    expect(escolhaForaDasOpcoes(DIAS, escolha(''))).toBe(false);
    expect(escolhaForaDasOpcoes(DIAS, escolha(ABRANGENCIAS.MUNICIPAL.codigo))).toBe(false);
    expect(escolhaForaDasOpcoes(DIAS, escolha(ABRANGENCIAS.MUNICIPAL.codigo, '9999999'))).toBe(
      true,
    );
    expect(escolhaForaDasOpcoes(DIAS, escolha(ABRANGENCIAS.NACIONAL.codigo))).toBe(true);
    expect(escolhaForaDasOpcoes([], escolha(ABRANGENCIAS.MUNICIPAL.codigo))).toBe(true);
  });
});
