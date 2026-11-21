import { describe, expect, it } from 'vitest';

import {
  controleDoRecurso,
  ehDoPrazoDaSegundaInstancia,
  ehParametroDoRecurso,
} from './controle-do-recurso';

describe('controleDoRecurso', () => {
  it.each([
    ['regraCodigo', 'regra'],
    ['regraVersao', 'regra'],
    ['prazoValor', 'prazoValor'],
    ['prazoUnidade', 'prazoUnidade'],
    ['ancora', 'origemDoPrazo'],
    ['atoAncoraCodigo', 'ancora'],
    ['admiteInstanciaSuperior', 'admiteInstanciaSuperior'],
    ['efeitoSuspensivo', 'efeitoSuspensivo'],
    ['guardaDaVaga', 'guardaDaVaga'],
    ['prazoSegundaInstanciaValor', 'prazoSegundaInstanciaValor'],
    ['prazoSegundaInstanciaUnidade', 'prazoSegundaInstanciaUnidade'],
  ])('leva o campo %s ao controle %s, sem juntar valor e unidade', (campo, controle) => {
    expect(controleDoRecurso(campo)).toBe(controle);
  });

  it('lê o campo sem distinguir a caixa que a API usa', () => {
    expect(controleDoRecurso('PrazoUnidade')).toBe('prazoUnidade');
  });

  it.each(['procedimentos', '', 'campoQueNaoExiste', 'prazoSegundaInstancia'])(
    'não acha controle para %j',
    (campo) => {
      expect(controleDoRecurso(campo)).toBeNull();
    },
  );

  it('reconhece só os controles do prazo da segunda instância', () => {
    expect(ehDoPrazoDaSegundaInstancia('prazoSegundaInstanciaValor')).toBe(true);
    expect(ehDoPrazoDaSegundaInstancia('prazoSegundaInstanciaUnidade')).toBe(true);
    expect(ehDoPrazoDaSegundaInstancia('guardaDaVaga')).toBe(false);
    expect(ehDoPrazoDaSegundaInstancia('prazoValor')).toBe(false);
  });

  it.each([
    'prazoValor',
    'prazoUnidade',
    'admiteInstanciaSuperior',
    'efeitoSuspensivo',
    'guardaDaVaga',
    'prazoSegundaInstanciaValor',
    'prazoSegundaInstanciaUnidade',
  ])('reconhece %s como parâmetro do componente comum', (controle) => {
    expect(ehParametroDoRecurso(controle)).toBe(true);
  });

  it.each(['regra', 'origemDoPrazo', 'ancora'])(
    'não trata %s como parâmetro: a fase e a etapa o desenham à parte',
    (controle) => {
      expect(ehParametroDoRecurso(controle)).toBe(false);
    },
  );
});
