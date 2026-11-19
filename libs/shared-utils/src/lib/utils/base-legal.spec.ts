import { describe, expect, it } from 'vitest';

import {
  baseLegalNova,
  baseLegalParaEnvio,
  basesLegaisParaEnvio,
  temNormaResolvida,
} from './base-legal';

describe('baseLegalNova', () => {
  it('nasce em branco, no próprio edital, resolvida e sem observação', () => {
    expect(baseLegalNova()).toEqual({
      referencia: '',
      abrangencia: 'INTERNA_EDITAL',
      status: 'RESOLVIDO',
      observacao: null,
    });
  });

  it('devolve uma norma nova a cada chamada', () => {
    expect(baseLegalNova()).not.toBe(baseLegalNova());
  });
});

describe('temNormaResolvida', () => {
  const norma = (referencia: string, status: string) => ({
    ...baseLegalNova(),
    referencia,
    status,
  });

  it('pede referência declarada e status resolvido', () => {
    expect(temNormaResolvida([])).toBe(false);
    expect(temNormaResolvida([norma('   ', 'RESOLVIDO')])).toBe(false);
    expect(temNormaResolvida([norma('Lei 12.711/2012', 'PENDENTE')])).toBe(false);
    expect(temNormaResolvida([norma('Lei 12.711/2012', 'RESOLVIDO')])).toBe(true);
  });

  it('basta uma das normas', () => {
    expect(
      temNormaResolvida([norma('Lei A', 'PENDENTE'), norma('Edital 01/2027', 'RESOLVIDO')]),
    ).toBe(true);
  });
});

describe('envio da norma', () => {
  it('tira os espaços das pontas e leva a observação em branco como null', () => {
    expect(
      baseLegalParaEnvio({
        referencia: '  Lei 12.711/2012  ',
        abrangencia: 'FEDERAL',
        status: 'PENDENTE',
        observacao: '   ',
      }),
    ).toEqual({
      referencia: 'Lei 12.711/2012',
      abrangencia: 'FEDERAL',
      status: 'PENDENTE',
      observacao: null,
    });
    expect(baseLegalParaEnvio({ ...baseLegalNova(), observacao: ' cotas ' }).observacao).toBe(
      'cotas',
    );
  });

  it('não leva a norma sem referência', () => {
    expect(
      basesLegaisParaEnvio([
        { ...baseLegalNova(), referencia: 'Lei A' },
        baseLegalNova(),
        { ...baseLegalNova(), referencia: '  ' },
      ]).map((base) => base.referencia),
    ).toEqual(['Lei A']);
  });
});
