import { describe, expect, it } from 'vitest';
import { CODIGO_CADASTRO_FORMATO, sugerirCodigoDeCadastro } from './codigo-cadastro.util';

describe('sugerirCodigoDeCadastro', () => {
  it('deriva o código do nome em UPPER_SNAKE, sem acento', () => {
    expect(sugerirCodigoDeCadastro('Laudo médico')).toBe('LAUDO_MEDICO');
    expect(sugerirCodigoDeCadastro('Autodeclaração étnico-racial')).toBe(
      'AUTODECLARACAO_ETNICO_RACIAL',
    );
  });

  it('colapsa pontuação e espaços repetidos num único sublinhado', () => {
    expect(sugerirCodigoDeCadastro('Comprovante  de   residência.')).toBe(
      'COMPROVANTE_DE_RESIDENCIA',
    );
    expect(sugerirCodigoDeCadastro('RG / CIN')).toBe('RG_CIN');
  });

  it('preserva dígito que não esteja na primeira posição', () => {
    expect(sugerirCodigoDeCadastro('Declaração de IRPF 2025')).toBe('DECLARACAO_DE_IRPF_2025');
    expect(sugerirCodigoDeCadastro('Lei 12711')).toBe('LEI_12711');
  });

  it('não sugere nada quando o resultado seria recusado pelo formato', () => {
    // Sugerir código inválido deixaria o campo em erro sem o operador tê-lo tocado.
    expect(sugerirCodigoDeCadastro('21 de abril')).toBe('');
    expect(sugerirCodigoDeCadastro('A')).toBe('');
    expect(sugerirCodigoDeCadastro('---')).toBe('');
    expect(sugerirCodigoDeCadastro('')).toBe('');
    expect(sugerirCodigoDeCadastro('   ')).toBe('');
  });

  it('trunca no tamanho máximo aceito pela API', () => {
    const sugestao = sugerirCodigoDeCadastro('a'.repeat(80));

    expect(sugestao).toHaveLength(50);
    expect(CODIGO_CADASTRO_FORMATO.test(sugestao)).toBe(true);
  });

  it('nunca devolve valor que o próprio formato recusaria', () => {
    // A garantia que sustenta o uso: a sugestão ou é vazia, ou é aceitável.
    const nomes = [
      'Laudo médico',
      '21 de abril',
      'A',
      '---',
      'Ção',
      '_sublinhado inicial',
      'a'.repeat(80),
      'Histórico do ensino médio',
    ];

    for (const nome of nomes) {
      const sugestao = sugerirCodigoDeCadastro(nome);
      expect(sugestao === '' || CODIGO_CADASTRO_FORMATO.test(sugestao)).toBe(true);
    }
  });
});
