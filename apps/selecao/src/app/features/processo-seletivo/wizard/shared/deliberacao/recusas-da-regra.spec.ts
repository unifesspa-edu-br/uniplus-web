import { describe, expect, it } from 'vitest';

import type { RecusaOrdenada } from '../recusas/ordem-das-recusas';
import {
  alvosDaRecusaDaBanca,
  campoDaBancaNoCaminho,
  CAMPOS_DA_BANCA,
  errosDaBancaPorCampo,
  recusasDaBancaPorCampo,
} from './recusas-da-regra';

describe('errosDaBancaPorCampo', () => {
  it('reúne só os campos que têm erro', () => {
    const erros = errosDaBancaPorCampo((campo) => (campo === 'quorum' ? 'fora' : null));

    expect(erros).toEqual({ quorum: 'fora' });
  });

  it('ignora o erro vazio ou indefinido', () => {
    expect(errosDaBancaPorCampo((campo) => (campo === 'modo' ? '' : undefined))).toEqual({});
  });

  it('consulta cada lugar sob o qual a recusa pode aparecer', () => {
    const consultados: string[] = [];
    errosDaBancaPorCampo((campo) => {
      consultados.push(campo);
      return null;
    });

    expect(consultados).toEqual([...CAMPOS_DA_BANCA]);
  });
});

describe('recusasDaBancaPorCampo', () => {
  const recusa = { campo: 'bancas.0.quorum', codigo: 'x' } as RecusaOrdenada;

  it('reúne só os campos que têm recusa', () => {
    const recusas = recusasDaBancaPorCampo((campo) => (campo === 'quorum' ? [recusa] : []));

    expect(recusas).toEqual({ quorum: [recusa] });
  });
});

describe('campoDaBancaNoCaminho', () => {
  it.each([
    [['regraDeDeliberacao', 'quorum'], 'quorum'],
    [['RegraDeDeliberacao', 'SemUnanimidade'], 'semUnanimidade'],
    [['regraDeDeliberacao', 'campoQueNaoExiste'], 'regra'],
    [['regraDeDeliberacao'], 'regra'],
    [['tipoBancaId'], null],
    [[], null],
  ])('lê %j como %s', (caminho, campo) => {
    expect(campoDaBancaNoCaminho(caminho)).toBe(campo);
  });
});

describe('alvosDaRecusaDaBanca', () => {
  it('prefere o controle, depois o bloco das recusas dele e o do modo, que mostra o que não tem controle', () => {
    expect(alvosDaRecusaDaBanca('base', 'quorum')).toEqual([
      'base-quorum',
      'base-quorum-recusas',
      'base-modo-recusas',
    ]);
  });

  it('leva o modo e a regra inteira ao modo, sem repetir o bloco', () => {
    expect(alvosDaRecusaDaBanca('base', 'modo')).toEqual(['base-modo', 'base-modo-recusas']);
    expect(alvosDaRecusaDaBanca('base', 'regra')).toEqual(['base-modo', 'base-modo-recusas']);
  });
});
