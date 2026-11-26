import { describe, expect, it } from 'vitest';

import { campoDaHomologacao, lugarNaHomologacao } from './campo-da-homologacao';

const campoDe = (caminho: string) => campoDaHomologacao(caminho.split('.'));

describe('campoDaHomologacao', () => {
  it('leva o resultado ao campo do resultado', () => {
    expect(campoDe('resultadoAtoCodigo')).toBe('homologacao.resultado');
  });

  it.each([
    ['alternativas.0.condicoes.1.tipo', 'homologacao.alternativas.0.condicoes.1.tipo'],
    [
      'alternativas.2.condicoes.0.edicaoDoExame',
      'homologacao.alternativas.2.condicoes.0.edicaoDoExame',
    ],
    [
      'alternativas.1.condicoes.0.motivoDesfavoravelCodigo',
      'homologacao.alternativas.1.condicoes.0.motivoDesfavoravelCodigo',
    ],
    [
      'alternativas.0.condicoes.0.enquadramento',
      'homologacao.alternativas.0.condicoes.0.enquadramento',
    ],
  ])('leva %s ao controle da condição', (caminho, campo) => {
    expect(campoDe(caminho)).toBe(campo);
  });

  it('reúne no enquadramento o que está dentro dele', () => {
    expect(campoDe('alternativas.0.condicoes.0.enquadramento.1.0.valor')).toBe(
      'homologacao.alternativas.0.condicoes.0.enquadramento',
    );
  });

  it('reconhece o campo sem diferença de maiúsculas', () => {
    expect(campoDe('Alternativas.0.Condicoes.1.EdicaoDoExame')).toBe(
      'homologacao.alternativas.0.condicoes.1.edicaoDoExame',
    );
  });

  it('leva a recusa às condições da alternativa à alternativa inteira', () => {
    expect(campoDe('alternativas.1.condicoes')).toBe('homologacao.alternativas.1');
  });

  it('leva a recusa a um campo de condição que a tela não conhece à alternativa', () => {
    expect(campoDe('alternativas.1.condicoes.0.campoNovo')).toBe('homologacao.alternativas.1');
  });

  it.each(['', 'alternativas', 'alternativas.x', 'campoNovo'])(
    'leva "%s" à regra inteira',
    (caminho) => {
      expect(campoDe(caminho)).toBe('homologacao');
    },
  );
});

describe('lugarNaHomologacao', () => {
  it('lê a alternativa, a condição e o controle', () => {
    expect(lugarNaHomologacao('homologacao.alternativas.2.condicoes.1.tipo')).toEqual({
      alternativa: 2,
      condicao: 1,
      controle: 'tipo',
    });
  });

  it('lê só a alternativa quando o campo é dela', () => {
    expect(lugarNaHomologacao('homologacao.alternativas.2')).toEqual({
      alternativa: 2,
      condicao: null,
      controle: null,
    });
  });

  it.each(['homologacao', 'homologacao.resultado'])('não cita lugar em %s', (campo) => {
    expect(lugarNaHomologacao(campo)).toEqual({
      alternativa: null,
      condicao: null,
      controle: null,
    });
  });
});
