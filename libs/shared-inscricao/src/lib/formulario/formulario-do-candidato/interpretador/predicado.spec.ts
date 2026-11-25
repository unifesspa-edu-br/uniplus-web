import { describe, expect, it } from 'vitest';
import {
  avaliarOuVerdadeiro,
  avaliarPredicado,
  comparaComLista,
  ehNegacao,
  ehOperador,
  fatosCitadosPor,
  type Condicao,
} from './predicado';
import { FATO_NAO_APLICAVEL, FATO_NAO_INFORMADO, resolvido } from './logica';
import type { ValorJson } from './regras-do-formulario';

function avaliar(condicao: Condicao, valor: ValorJson) {
  return avaliarPredicado({ clausulas: [[condicao]] }, new Map([['A', resolvido(valor)]]));
}

describe('operadores do predicado', () => {
  it('só EM e NENHUM_DE comparam com uma lista', () => {
    expect(['ALGUM_DE', 'NENHUM_DE'].every(comparaComLista)).toBe(true);
    expect(['IGUAL', 'DIFERENTE', 'MAIOR_IGUAL', 'MENOR_IGUAL'].some(comparaComLista)).toBe(false);
  });

  it('só DIFERENTE e NENHUM_DE são negação', () => {
    expect(['DIFERENTE', 'NENHUM_DE'].every(ehNegacao)).toBe(true);
    expect(['IGUAL', 'ALGUM_DE', 'MAIOR_IGUAL', 'MENOR_IGUAL', ''].some(ehNegacao)).toBe(false);
  });

  it('o operador desconhecido não é reconhecido', () => {
    expect(ehOperador('IGUAL')).toBe(true);
    expect(ehOperador('PARECIDO')).toBe(false);
  });
});

it('predicado ausente vale sempre e o vazio é falso', () => {
  expect(avaliarOuVerdadeiro(null, new Map())).toBe('VERDADEIRO');
  expect(avaliarPredicado({ clausulas: [] }, new Map())).toBe('FALSO');
});

it('lista fatos citados sem duplicatas', () => {
  const condicao: Condicao = { fato: 'A', operador: 'IGUAL', valor: true };
  expect(fatosCitadosPor({ clausulas: [[condicao, condicao]] })).toEqual(['A']);
  expect(fatosCitadosPor(null)).toEqual([]);
});

it('mantém indeterminação quando falta fato', () => {
  const predicado = { clausulas: [[{ fato: 'A', operador: 'IGUAL' as const, valor: true }]] };
  expect(avaliarPredicado(predicado, new Map())).toBe('INDETERMINADO');
});

it('fato não aplicável ou não informado não satisfaz nem negação', () => {
  const predicado = { clausulas: [[{ fato: 'A', operador: 'DIFERENTE' as const, valor: true }]] };
  expect(avaliarPredicado(predicado, new Map([['A', FATO_NAO_APLICAVEL]]))).toBe('FALSO');
  expect(avaliarPredicado(predicado, new Map([['A', FATO_NAO_INFORMADO]]))).toBe('FALSO');
});

it('compara igualdade e sua negação em valores da mesma forma', () => {
  expect(avaliar({ fato: 'A', operador: 'IGUAL', valor: 'Sim' }, 'Sim')).toBe('VERDADEIRO');
  expect(avaliar({ fato: 'A', operador: 'DIFERENTE', valor: 'Sim' }, 'Não')).toBe('VERDADEIRO');
});

it('mantém indeterminada a comparação de formas diferentes', () => {
  expect(avaliar({ fato: 'A', operador: 'DIFERENTE', valor: 1 }, '1')).toBe('INDETERMINADO');
});

it('compara número nos limites inclusivos', () => {
  expect(avaliar({ fato: 'A', operador: 'MAIOR_IGUAL', valor: 2 }, 2)).toBe('VERDADEIRO');
  expect(avaliar({ fato: 'A', operador: 'MENOR_IGUAL', valor: 2 }, 3)).toBe('FALSO');
});

it('compara valores escolhidos com a lista configurada', () => {
  expect(avaliar({ fato: 'A', operador: 'ALGUM_DE', valor: ['B', 'C'] }, ['A', 'B'])).toBe(
    'VERDADEIRO',
  );
  expect(avaliar({ fato: 'A', operador: 'NENHUM_DE', valor: ['B'] }, 'A')).toBe('VERDADEIRO');
  expect(avaliar({ fato: 'A', operador: 'IGUAL', valor: 'A' }, ['A', 'B'])).toBe('VERDADEIRO');
});
