import { describe, expect, it } from 'vitest';

import { digitosDoTelefone, formatarTelefone } from './telefone.util';

describe('formatarTelefone', () => {
  it('formata o fixo com DDD', () => {
    expect(formatarTelefone('6133334444')).toBe('(61) 3333-4444');
    expect(formatarTelefone('(94) 3322-1234')).toBe('(94) 3322-1234');
    expect(formatarTelefone('94 3322.1234')).toBe('(94) 3322-1234');
  });

  it('formata o celular com DDD', () => {
    expect(formatarTelefone('61981951555')).toBe('(61) 98195-1555');
  });

  it('devolve como chegou o que não é telefone, sem máscara parcial', () => {
    expect(formatarTelefone('619819')).toBe('619819');
    expect(formatarTelefone('01981951555')).toBe('01981951555');
    expect(formatarTelefone('61881951555')).toBe('61881951555');
    expect(formatarTelefone(null)).toBe('');
  });
});

describe('digitosDoTelefone', () => {
  it('tira a máscara do telefone válido e recusa o que não é telefone', () => {
    expect(digitosDoTelefone('(61) 98195-1555')).toBe('61981951555');
    expect(digitosDoTelefone('61 3333.4444')).toBe('6133334444');
    expect(digitosDoTelefone('61a981951555')).toBeNull();
    expect(digitosDoTelefone('   ')).toBeNull();
  });
});
