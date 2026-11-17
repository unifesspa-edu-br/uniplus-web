import { describe, expect, it } from 'vitest';
import { separarCausas } from './causas-do-problema';

describe('separarCausas', () => {
  it('causa com field vazio aponta campo e fica em deCampo', () => {
    const { deCampo, gerais } = separarCausas([{ field: '', code: 'A', message: 'a' }]);

    expect(deCampo).toEqual([{ field: '', code: 'A', message: 'a' }]);
    expect(gerais).toEqual([]);
  });

  it('causa sem field fica em gerais', () => {
    const { deCampo, gerais } = separarCausas([{ code: 'B', message: 'b' }]);

    expect(deCampo).toEqual([]);
    expect(gerais).toEqual([{ code: 'B', message: 'b' }]);
  });

  it('lista ausente devolve duas listas vazias', () => {
    expect(separarCausas(undefined)).toEqual({ deCampo: [], gerais: [] });
  });

  it('mantém a ordem do fio em cada lista', () => {
    const { deCampo, gerais } = separarCausas([
      { field: 'b', code: '1', message: '1' },
      { code: '2', message: '2' },
      { field: 'a', code: '3', message: '3' },
      { code: '4', message: '4' },
    ]);

    expect(deCampo.map((causa) => causa.field)).toEqual(['b', 'a']);
    expect(gerais.map((causa) => causa.code)).toEqual(['2', '4']);
  });
});
