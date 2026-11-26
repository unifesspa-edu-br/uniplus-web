import { describe, expect, it } from 'vitest';
import { limiteDeTrabalhadores } from './limite-de-trabalhadores';

const GB = 1024 ** 3;

describe('limite de trabalhadores', () => {
  it('limita uma máquina grande pela memória', () => {
    expect(limiteDeTrabalhadores(20, 30 * GB)).toBe(7);
  });

  it('limita pelos núcleos quando há memória suficiente', () => {
    expect(limiteDeTrabalhadores(4, 64 * GB)).toBe(4);
  });

  it('limita uma máquina com pouca memória', () => {
    expect(limiteDeTrabalhadores(8, 6 * GB)).toBe(1);
  });

  it('mantém pelo menos um trabalhador abaixo de 4 GB', () => {
    expect(limiteDeTrabalhadores(8, 3 * GB)).toBe(1);
  });

  it('acrescenta um trabalhador ao atingir cada múltiplo de 4 GB', () => {
    expect(limiteDeTrabalhadores(8, 8 * GB - 1)).toBe(1);
    expect(limiteDeTrabalhadores(8, 8 * GB)).toBe(2);
  });
});
