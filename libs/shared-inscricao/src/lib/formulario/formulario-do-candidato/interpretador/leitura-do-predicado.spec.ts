import { expect, it } from 'vitest';
import {
  lerCondicaoQueValeSempreSeVazia,
  lerExibicaoEObrigatoriedade,
  lerImpedimento,
  lerObrigatoriedade,
  lerPredicado,
} from './leitura-do-predicado';

it('distingue predicado ausente de lista vazia', () => {
  expect(lerPredicado(null, 'predicado')).toBeNull();
  expect(lerPredicado([], 'predicado')).toEqual({ clausulas: [] });
  expect(lerCondicaoQueValeSempreSeVazia([], 'predicado')).toBeNull();
});

it('recusa cláusula sem condições', () => {
  expect(() => lerPredicado([[]], 'predicado')).toThrow(
    'Uma cláusula deve ter ao menos uma condição.',
  );
});

it('recusa condição com fato ou operador inválido', () => {
  expect(() => lerPredicado([[{ fato: ' ', operador: 'IGUAL', valor: true }]], 'p')).toThrow(
    'O fato da condição é obrigatório.',
  );
  expect(() => lerPredicado([[{ fato: 'A', operador: 'OUTRO', valor: true }]], 'p')).toThrow(
    'O operador da condição não é reconhecido.',
  );
});

it('exige lista para operador de lista e escalar para igualdade', () => {
  expect(() => lerPredicado([[{ fato: 'A', operador: 'ALGUM_DE', valor: 'A' }]], 'p')).toThrow(
    'exigem uma lista',
  );
  expect(() => lerPredicado([[{ fato: 'A', operador: 'IGUAL', valor: [] }]], 'p')).toThrow(
    'exigem um valor simples',
  );
});

it('lê condição válida com fato sem espaços externos', () => {
  expect(lerPredicado([[{ fato: ' A ', operador: 'IGUAL', valor: true }]], 'p')).toEqual({
    clausulas: [[{ fato: 'A', operador: 'IGUAL', valor: true }]],
  });
});

it('exige predicado somente para obrigatoriedade condicional', () => {
  expect(lerObrigatoriedade({ tipo: 'SEMPRE' }, 'r', 'campo')).toEqual({
    tipo: 'SEMPRE',
    predicado: null,
  });
  expect(() => lerObrigatoriedade({ tipo: 'QUANDO' }, 'r', 'campo')).toThrow(
    'A obrigatoriedade do campo',
  );
});

it('recusa regras ausentes e impedimento sem condição', () => {
  expect(() => lerExibicaoEObrigatoriedade(null, 'r', 'campo')).toThrow(
    'As regras do campo são um objeto.',
  );
  expect(() => lerImpedimento({ quando: [] }, 'i')).toThrow('O impedimento tem a condição');
  expect(lerImpedimento(null, 'i')).toBeNull();
});
