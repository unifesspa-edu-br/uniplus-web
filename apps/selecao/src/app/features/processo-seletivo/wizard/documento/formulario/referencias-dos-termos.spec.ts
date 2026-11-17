import { describe, expect, it } from 'vitest';

import { referenciaPorCodigoENumero, referenciaPorIdentificadores } from './referencias-dos-termos';

const referencias = [
  { termoId: 't1', termoCodigo: 'TERMO', versaoId: 'v1', versaoNumero: 1 },
  { termoId: 't1', termoCodigo: 'TERMO', versaoId: 'v2', versaoNumero: 2 },
  { termoId: 't2', termoCodigo: 'OUTRO', versaoId: 'v3', versaoNumero: 1 },
];

describe('referências das versões dos termos', () => {
  it('resolve as duas identidades da mesma versão', () => {
    expect(referenciaPorCodigoENumero(referencias, 'TERMO', 2)).toEqual(referencias[1]);
    expect(referenciaPorIdentificadores(referencias, 't1', 'v2')).toEqual(referencias[1]);
  });

  it('recusa versão ausente ou pertencente a outro termo', () => {
    expect(referenciaPorCodigoENumero(referencias, 'TERMO', 3)).toBeUndefined();
    expect(referenciaPorIdentificadores(referencias, 't1', 'v3')).toBeUndefined();
  });

  it('recusa correspondências ambíguas', () => {
    const duplicadas = [...referencias, referencias[0]];
    expect(referenciaPorCodigoENumero(duplicadas, 'TERMO', 1)).toBeUndefined();
    expect(referenciaPorIdentificadores(duplicadas, 't1', 'v1')).toBeUndefined();
  });
});
