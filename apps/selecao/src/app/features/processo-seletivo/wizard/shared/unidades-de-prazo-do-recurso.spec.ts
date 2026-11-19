import { UnidadePrazo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  prazoEmTexto,
  UNIDADES_DA_INTERPOSICAO,
  UNIDADES_DA_SUSPENSIVIDADE,
} from './unidades-de-prazo-do-recurso';

const valores = (unidades: readonly { valor: UnidadePrazo }[]) => unidades.map((u) => u.valor);

describe('unidades do prazo de recurso', () => {
  it('a interposição oferece dias úteis e horas, sem dia corrido', () => {
    expect(valores(UNIDADES_DA_INTERPOSICAO)).toEqual([UnidadePrazo.diasUteis, UnidadePrazo.horas]);
    expect(UNIDADES_DA_INTERPOSICAO.map((u) => u.rotulo)).toEqual(['dias úteis', 'horas']);
  });

  it('a suspensividade oferece dias úteis, dias corridos e horas', () => {
    expect(valores(UNIDADES_DA_SUSPENSIVIDADE)).toEqual([
      UnidadePrazo.diasUteis,
      UnidadePrazo.dias,
      UnidadePrazo.horas,
    ]);
    expect(UNIDADES_DA_SUSPENSIVIDADE.map((u) => u.rotulo)).toEqual([
      'dias úteis',
      'dias corridos',
      'horas',
    ]);
  });

  it('nenhuma lista oferece o valor-zero do enum', () => {
    expect(valores(UNIDADES_DA_INTERPOSICAO)).not.toContain(UnidadePrazo.nenhuma);
    expect(valores(UNIDADES_DA_SUSPENSIVIDADE)).not.toContain(UnidadePrazo.nenhuma);
  });
});

describe('prazoEmTexto', () => {
  it.each([
    ['1', UnidadePrazo.horas, '1 hora'],
    ['2', UnidadePrazo.horas, '2 horas'],
    ['1', UnidadePrazo.diasUteis, '1 dia útil'],
    ['2', UnidadePrazo.diasUteis, '2 dias úteis'],
    ['1', UnidadePrazo.dias, '1 dia corrido'],
    ['3', UnidadePrazo.dias, '3 dias corridos'],
    ['1,0', UnidadePrazo.dias, '1,0 dia corrido'],
    ['1,5', UnidadePrazo.horas, '1,5 horas'],
  ])('lê %s %s como "%s"', (valor, unidade, texto) => {
    expect(prazoEmTexto(valor, unidade)).toBe(texto);
  });

  it('devolve vazio quando não há valor', () => {
    expect(prazoEmTexto('', UnidadePrazo.horas)).toBe('');
    expect(prazoEmTexto('  ', UnidadePrazo.dias)).toBe('');
  });

  it('mostra como veio a unidade que a tela não conhece', () => {
    expect(prazoEmTexto('2', 'quinzenas')).toBe('2 quinzenas');
  });
});
