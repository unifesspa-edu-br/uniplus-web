import { describe, expect, it } from 'vitest';
import { controlNameFromBackendField, nullIfBlank } from './campo-do-backend';

const CONTROLES: ReadonlySet<string> = new Set(['codigo', 'vigenciaInicio', 'cep']);

describe('controlNameFromBackendField', () => {
  it('converte o PascalCase do servidor no camelCase do formulário', () => {
    expect(controlNameFromBackendField('Codigo', CONTROLES)).toBe('codigo');
    expect(controlNameFromBackendField('VigenciaInicio', CONTROLES)).toBe('vigenciaInicio');
  });

  it('descarta o caminho e o índice, que o formulário não reproduz', () => {
    expect(controlNameFromBackendField('Endereco.Cep', CONTROLES)).toBe('cep');
    expect(controlNameFromBackendField('Itens[2].Codigo', CONTROLES)).toBe('codigo');
  });

  it('devolve null para campo fora do conjunto declarado', () => {
    expect(controlNameFromBackendField('Inexistente', CONTROLES)).toBeNull();
  });

  it('não confunde índice no meio do caminho com sufixo', () => {
    expect(controlNameFromBackendField('Itens[0].Endereco.Cep', CONTROLES)).toBe('cep');
  });

  it('preserva o campo quando não há caminho a remover', () => {
    expect(controlNameFromBackendField('cep', CONTROLES)).toBe('cep');
  });
});

describe('nullIfBlank', () => {
  it('trata string vazia e só-espaços como ausência', () => {
    expect(nullIfBlank('')).toBeNull();
    expect(nullIfBlank('   ')).toBeNull();
  });

  it('devolve o valor sem as bordas em branco', () => {
    expect(nullIfBlank('  Lei 12.711/2012 ')).toBe('Lei 12.711/2012');
  });
});
