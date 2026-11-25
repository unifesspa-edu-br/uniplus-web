import { describe, expect, it } from 'vitest';
import { codigosDoContrato } from './codigos-do-contrato';

enum OperadorDeTeste {
  IGUAL = 'IGUAL',
  DIFERENTE = 'DIFERENTE',
}

enum TipoDeCampoDeTeste {
  TEXTO = 'TEXTO',
  DATA = 'DATA',
}

describe('codigosDoContrato', () => {
  const codigos = codigosDoContrato(OperadorDeTeste, TipoDeCampoDeTeste);

  it('traduz o operador conhecido para o membro do enum de operadores', () => {
    expect(codigos.operador('DIFERENTE')).toBe(OperadorDeTeste.DIFERENTE);
  });

  it('devolve null para o operador que o contrato não conhece', () => {
    expect(codigos.operador('PARECIDO')).toBeNull();
  });

  it('traduz o tipo de renderização conhecido para o membro do enum de renderizações', () => {
    expect(codigos.tipoDeCampo('DATA')).toBe(TipoDeCampoDeTeste.DATA);
  });

  it('devolve null para o tipo de renderização que o contrato não conhece', () => {
    expect(codigos.tipoDeCampo('IGUAL')).toBeNull();
  });
});
