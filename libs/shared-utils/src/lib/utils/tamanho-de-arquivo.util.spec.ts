import { describe, expect, it } from 'vitest';
import { formatarTamanhoDeArquivo } from './tamanho-de-arquivo.util';

describe('formatarTamanhoDeArquivo', () => {
  it('escolhe a unidade e usa vírgula decimal', () => {
    expect(formatarTamanhoDeArquivo(512)).toBe('512 B');
    expect(formatarTamanhoDeArquivo(2048)).toBe('2,0 KB');
    expect(formatarTamanhoDeArquivo(2.5 * 1024 * 1024)).toBe('2,5 MB');
  });

  it('aceita número em texto e recusa o que não é número', () => {
    expect(formatarTamanhoDeArquivo('4096')).toBe('4,0 KB');
    expect(formatarTamanhoDeArquivo(null)).toBe('tamanho indisponível');
    expect(formatarTamanhoDeArquivo('abc')).toBe('tamanho indisponível');
  });
});
