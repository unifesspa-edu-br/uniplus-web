import { describe, expect, it } from 'vitest';
import { type ClausulasNoWire, predicadoComOperadores } from './condicoes-no-wire';

const EM_MAIUSCULAS = (codigo: string): string => codigo.toUpperCase();
const SOMENTE_IGUAL = (codigo: string): string | null => (codigo === 'igual' ? 'IGUAL' : null);

describe('predicadoComOperadores', () => {
  it('troca o operador conhecido pelo que o tradutor devolve', () => {
    const clausulas: ClausulasNoWire = [[{ fato: 'idade', operador: 'igual', valor: 18 }]];

    expect(predicadoComOperadores(clausulas, SOMENTE_IGUAL)).toEqual([
      [{ fato: 'idade', operador: 'IGUAL', valor: 18 }],
    ]);
  });

  it('troca o operador desconhecido pelo que o tradutor devolve para ele', () => {
    const clausulas: ClausulasNoWire = [[{ fato: 'idade', operador: 'parecido', valor: 18 }]];

    expect(predicadoComOperadores(clausulas, SOMENTE_IGUAL)).toEqual([
      [{ fato: 'idade', operador: null, valor: 18 }],
    ]);
  });

  it('mantém nulo o predicado nulo', () => {
    expect(predicadoComOperadores(null, EM_MAIUSCULAS)).toBeNull();
  });

  it('mantém indefinido o predicado indefinido', () => {
    expect(predicadoComOperadores(undefined, EM_MAIUSCULAS)).toBeUndefined();
  });

  it('mantém a ordem das cláusulas e das condições, o fato e o valor', () => {
    const clausulas: ClausulasNoWire = [
      [
        { fato: 'a', operador: 'x', valor: true },
        { fato: 'b', operador: 'y', valor: ['AC'] },
      ],
      [{ fato: 'c', operador: 'z', valor: 'PRETA' }],
    ];

    expect(predicadoComOperadores(clausulas, EM_MAIUSCULAS)).toEqual([
      [
        { fato: 'a', operador: 'X', valor: true },
        { fato: 'b', operador: 'Y', valor: ['AC'] },
      ],
      [{ fato: 'c', operador: 'Z', valor: 'PRETA' }],
    ]);
  });
});
