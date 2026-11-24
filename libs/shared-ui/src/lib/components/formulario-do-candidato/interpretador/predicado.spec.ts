import { describe, expect, it } from 'vitest';
import { comparaComLista, ehNegacao, ehOperador } from './predicado';

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
