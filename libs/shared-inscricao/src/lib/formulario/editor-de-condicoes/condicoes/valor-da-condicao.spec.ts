import { describe, expect, it } from 'vitest';
import {
  comOperador,
  comValorEscalar,
  comValoresDeLista,
  interpretar,
  valorEscalarDe,
  valoresDeListaDe,
} from './valor-da-condicao';
import type { FatoEscolhivel } from './fatos-escolhiveis';

const fato: FatoEscolhivel = {
  codigo: 'A',
  nome: 'Alternativa',
  tipoDominio: 'CATEGORICO_ESTATICO',
  operadoresAdmitidos: [],
  valores: [],
  coletavel: true,
};
const condicao = { fato: 'A', operador: 'IGUAL', valor: '' };

describe('valor da condição', () => {
  it('preserva texto parcial que ainda não é JSON', () => {
    expect(valorEscalarDe({ ...condicao, valor: '12.' })).toBe('12.');
    expect(interpretar('12.')).toBeUndefined();
  });
  it('lê escalares JSON e ignora valores compostos', () => {
    expect(valorEscalarDe({ ...condicao, valor: ' "sim" ' })).toBe('sim');
    expect(valorEscalarDe({ ...condicao, valor: ' 42 ' })).toBe('42');
    expect(valorEscalarDe({ ...condicao, valor: 'null' })).toBe('');
  });
  it('mantém somente textos de uma lista JSON', () => {
    expect(valoresDeListaDe({ ...condicao, valor: '["A",2,"B"]' })).toEqual(['A', 'B']);
    expect(valoresDeListaDe(condicao)).toEqual([]);
  });
  it('escreve o valor conforme o domínio do fato', () => {
    expect(comValorEscalar(condicao, fato, 'Sim').valor).toBe('"Sim"');
    expect(comValorEscalar(condicao, { ...fato, tipoDominio: 'NUMERICO' }, ' 1,5 ').valor).toBe(
      '1,5',
    );
    expect(comValorEscalar(condicao, { ...fato, tipoDominio: 'BOOLEANO' }, 'sim').valor).toBe('');
    expect(comValorEscalar(condicao, { ...fato, tipoDominio: 'BOOLEANO' }, 'false').valor).toBe(
      'false',
    );
  });
  it('representa lista vazia sem valor e serializa lista preenchida', () => {
    expect(comValoresDeLista(condicao, []).valor).toBe('');
    expect(comValoresDeLista(condicao, ['A']).valor).toBe('["A"]');
  });
  it('preserva o valor ao trocar entre operadores da mesma forma', () => {
    expect(comOperador({ ...condicao, valor: '"A"' }, fato, 'DIFERENTE').valor).toBe('"A"');
  });
});
