import { describe, expect, it } from 'vitest';
import { codigosDoContrato } from './codigos-do-contrato';

enum OperadorDeTeste {
  IGUAL = 'IGUAL',
  DIFERENTE = 'DIFERENTE',
}

enum RenderizacaoDeTeste {
  TEXTO = 'TEXTO',
  DATA = 'DATA',
}

describe('codigosDoContrato', () => {
  const codigos = codigosDoContrato(OperadorDeTeste, RenderizacaoDeTeste);

  it('traduz o operador conhecido para o membro do enum de operadores', () => {
    expect(codigos.operador('DIFERENTE')).toBe(OperadorDeTeste.DIFERENTE);
  });

  it('devolve null para o operador que o contrato não conhece', () => {
    expect(codigos.operador('PARECIDO')).toBeNull();
  });

  it('traduz o tipo de renderização conhecido para o membro do enum de renderizações', () => {
    expect(codigos.tipoRenderizacao('DATA')).toBe(RenderizacaoDeTeste.DATA);
  });

  it('devolve null para o tipo de renderização que o contrato não conhece', () => {
    expect(codigos.tipoRenderizacao('IGUAL')).toBeNull();
  });
});
