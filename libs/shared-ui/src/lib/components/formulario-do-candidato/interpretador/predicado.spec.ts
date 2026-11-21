import { describe, expect, it } from 'vitest';
import { comparaComLista, ehNegacao, ehOperador } from './predicado';

describe('operadores do predicado', () => {
  it('só EM e NAO_EM comparam com uma lista', () => {
    expect(['EM', 'NAO_EM'].every(comparaComLista)).toBe(true);
    expect(['IGUAL', 'DIFERENTE', 'MAIOR_IGUAL', 'MENOR_IGUAL'].some(comparaComLista)).toBe(false);
  });

  it('só DIFERENTE e NAO_EM são negação', () => {
    expect(['DIFERENTE', 'NAO_EM'].every(ehNegacao)).toBe(true);
    expect(['IGUAL', 'EM', 'MAIOR_IGUAL', 'MENOR_IGUAL', ''].some(ehNegacao)).toBe(false);
  });

  it('o operador desconhecido não é reconhecido', () => {
    expect(ehOperador('IGUAL')).toBe(true);
    expect(ehOperador('PARECIDO')).toBe(false);
  });
});
