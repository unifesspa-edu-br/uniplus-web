import { describe, expect, it } from 'vitest';
import { contarCaracteres } from './caracteres.util';

describe('contarCaracteres', () => {
  it('conta o texto vazio como zero', () => {
    expect(contarCaracteres('')).toBe(0);
  });

  it('conta letras acentuadas compostas como um caractere cada', () => {
    expect(contarCaracteres('ação')).toBe(4);
  });

  it('conta o caractere fora do plano básico como um, e não como dois', () => {
    expect('😀'.length).toBe(2);
    expect(contarCaracteres('😀')).toBe(1);
    expect(contarCaracteres('a😀b')).toBe(3);
  });
});
