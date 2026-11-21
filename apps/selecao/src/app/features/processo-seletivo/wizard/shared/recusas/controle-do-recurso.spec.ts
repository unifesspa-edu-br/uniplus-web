import { describe, expect, it } from 'vitest';

import { controleDoRecurso, ehDaSegundaInstancia } from './controle-do-recurso';

describe('controleDoRecurso', () => {
  it.each([
    ['regraCodigo', 'regra'],
    ['regraVersao', 'regra'],
    ['prazoValor', 'prazoValor'],
    ['prazoUnidade', 'prazoUnidade'],
    ['ancora', 'origemDoPrazo'],
    ['atoAncoraCodigo', 'ancora'],
    ['admiteInstanciaSuperior', 'admiteInstanciaSuperior'],
    ['suspensividadePrimeiraInstanciaValor', 'suspensividadePrimeiraInstanciaValor'],
    ['suspensividadePrimeiraInstanciaUnidade', 'suspensividadePrimeiraInstanciaUnidade'],
    ['suspensividadeSegundaInstanciaValor', 'suspensividadeSegundaInstanciaValor'],
    ['suspensividadeSegundaInstanciaUnidade', 'suspensividadeSegundaInstanciaUnidade'],
  ])('leva o campo %s ao controle %s, sem juntar valor e unidade', (campo, controle) => {
    expect(controleDoRecurso(campo)).toBe(controle);
  });

  it('lê o campo sem distinguir a caixa que a API usa', () => {
    expect(controleDoRecurso('PrazoUnidade')).toBe('prazoUnidade');
  });

  it.each(['procedimentos', '', 'suspensividadePrimeiraInstancia', 'prazo'])(
    'não acha controle para %j',
    (campo) => {
      expect(controleDoRecurso(campo)).toBeNull();
    },
  );

  it('reconhece só os controles da segunda instância', () => {
    expect(ehDaSegundaInstancia('suspensividadeSegundaInstanciaValor')).toBe(true);
    expect(ehDaSegundaInstancia('suspensividadePrimeiraInstanciaValor')).toBe(false);
    expect(ehDaSegundaInstancia('prazoValor')).toBe(false);
  });
});
