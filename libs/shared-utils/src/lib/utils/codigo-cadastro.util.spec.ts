import { describe, expect, it } from 'vitest';
import { CODIGO_CADASTRO_FORMATO, sugerirCodigoDeCadastro } from './codigo-cadastro.util';

describe('formato do código de cadastro', () => {
  it.each(['A', 'LEI_12711', 'ANALISE_DOCUMENTAL'])('aceita %s', (codigo) => {
    expect(CODIGO_CADASTRO_FORMATO.test(codigo)).toBe(true);
  });

  it.each([' A', 'A ', 'abc', 'Á', 'COR__RACA', 'COR_', '_AC', '1AC'])('recusa %s', (codigo) => {
    expect(CODIGO_CADASTRO_FORMATO.test(codigo)).toBe(false);
  });
});

describe('sugestão de código', () => {
  it.each([
    ['Laudo médico', 'LAUDO_MEDICO'],
    ['Autodeclaração étnico-racial', 'AUTODECLARACAO_ETNICO_RACIAL'],
    ['Comprovante  de   residência.', 'COMPROVANTE_DE_RESIDENCIA'],
    ['RG / CIN', 'RG_CIN'],
    ['Declaração de IRPF 2025', 'DECLARACAO_DE_IRPF_2025'],
    ['Lei 12711', 'LEI_12711'],
  ])('sugere %s como %s', (nome, esperado) => {
    expect(sugerirCodigoDeCadastro(nome)).toBe(esperado);
  });

  it.each([
    'Laudo médico',
    '21 de abril',
    'A',
    '---',
    'Ção',
    '_sublinhado inicial',
    'a'.repeat(80),
    'Histórico do ensino médio',
    '',
    '   ',
  ])('sugere um código vazio ou válido para %s', (nome) => {
    const sugestao = sugerirCodigoDeCadastro(nome);
    expect(sugestao === '' || CODIGO_CADASTRO_FORMATO.test(sugestao)).toBe(true);
  });

  it.each([50, 51, 80, 81])('mantém o candidato inteiro com %i caracteres', (tamanho) => {
    expect(sugerirCodigoDeCadastro('a'.repeat(tamanho))).toBe('A'.repeat(tamanho));
  });

  it('recusa resultado inválido e aceita uma letra', () => {
    expect(sugerirCodigoDeCadastro('21 de abril')).toBe('');
    expect(sugerirCodigoDeCadastro('---')).toBe('');
    expect(sugerirCodigoDeCadastro('')).toBe('');
    expect(sugerirCodigoDeCadastro('   ')).toBe('');
    expect(sugerirCodigoDeCadastro('A')).toBe('A');
  });
});
