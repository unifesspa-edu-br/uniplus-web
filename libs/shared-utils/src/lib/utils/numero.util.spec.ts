import { describe, expect, it } from 'vitest';

import { formatarNumeroPtBr } from './numero.util';

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
