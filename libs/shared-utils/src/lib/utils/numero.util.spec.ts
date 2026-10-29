import { describe, expect, it } from 'vitest';

import { formatarNumeroPtBr, numeroDaApi, numeroOuNuloDaApi } from './numero.util';

describe('formatarNumeroPtBr', () => {
  it('usa vírgula decimal e não fixa casas', () => {
    expect(formatarNumeroPtBr(2)).toBe('2');
    expect(formatarNumeroPtBr(1.5)).toBe('1,5');
    expect(formatarNumeroPtBr(400)).toBe('400');
  });

  it('mostra até o máximo de casas pedido', () => {
    expect(formatarNumeroPtBr(0.0001)).toBe('0');
    expect(formatarNumeroPtBr(0.0001, 4)).toBe('0,0001');
  });
});

describe('numeroDaApi / numeroOuNuloDaApi', () => {
  it('aceita número e texto, como o contrato serializa decimais', () => {
    expect(numeroDaApi(2.5)).toBe(2.5);
    expect(numeroDaApi('400.000')).toBe(400);
  });

  it('mantém ausência como null', () => {
    expect(numeroOuNuloDaApi(null)).toBeNull();
    expect(numeroOuNuloDaApi(undefined)).toBeNull();
    expect(numeroOuNuloDaApi('1.5')).toBe(1.5);
  });
});
