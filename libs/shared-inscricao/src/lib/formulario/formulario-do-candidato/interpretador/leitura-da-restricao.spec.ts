import { expect, it } from 'vitest';
import { lerLimiteDeData, lerRestricao } from './leitura-da-restricao';

it('recusa tipo de restrição desconhecido', () => {
  expect(() => lerRestricao({ tipo: 'OUTRO' }, 'r')).toThrow('O tipo da restrição');
});
it('exige limite na faixa numérica', () => {
  expect(() => lerRestricao({ tipo: 'FAIXA_NUMERICA' }, 'r')).toThrow(
    'precisa de ao menos um limite',
  );
});
it('recusa mínimo numérico maior que máximo', () => {
  expect(() => lerRestricao({ tipo: 'FAIXA_NUMERICA', minimo: 2, maximo: 1 }, 'r')).toThrow(
    'O mínimo (2) é maior que o máximo (1).',
  );
});
it('aceita faixa numérica com extremos iguais', () => {
  expect(lerRestricao({ tipo: 'FAIXA_NUMERICA', minimo: 2, maximo: 2 }, 'r')).toBeDefined();
});
it('exige limites inteiros no tamanho de texto', () => {
  expect(() => lerRestricao({ tipo: 'TAMANHO_TEXTO', minimo: 1.5 }, 'r')).toThrow(
    'números inteiros',
  );
});
it('recusa tamanho de texto sem limites ou com limite negativo', () => {
  expect(() => lerRestricao({ tipo: 'TAMANHO_TEXTO' }, 'r')).toThrow(
    'precisa de ao menos um limite',
  );
  expect(() => lerRestricao({ tipo: 'TAMANHO_TEXTO', minimo: -1 }, 'r')).toThrow('são incoerentes');
});
it('aceita tamanho de texto com mínimo zero', () => {
  expect(lerRestricao({ tipo: 'TAMANHO_TEXTO', minimo: 0 }, 'r')).toBeDefined();
});
it('exige grupo de valores nas opções permitidas', () => {
  expect(() => lerRestricao({ tipo: 'OPCOES_PERMITIDAS', entradas: [] }, 'r')).toThrow(
    'ao menos um grupo',
  );
  expect(
    lerRestricao({ tipo: 'OPCOES_PERMITIDAS', entradas: [{ quando: [], valores: ['A'] }] }, 'r'),
  ).toBeDefined();
});
it('lê opções das respostas a partir de fatos citados', () => {
  expect(lerRestricao({ tipo: 'OPCOES_DAS_RESPOSTAS', fatos: ['A'] }, 'r')).toBeDefined();
});
it('exige exatamente um fato para municípios da UF', () => {
  expect(() => lerRestricao({ tipo: 'MUNICIPIOS_DA_UF', fatos: ['A', 'B'] }, 'r')).toThrow(
    'exatamente um fato',
  );
  expect(lerRestricao({ tipo: 'MUNICIPIOS_DA_UF', fatos: ['A'] }, 'r')).toBeDefined();
});
it('exige limite na faixa de data', () => {
  expect(() => lerRestricao({ tipo: 'FAIXA_DE_DATA' }, 'r')).toThrow(
    'precisa de ao menos um limite',
  );
});
it('recusa data mínima posterior à máxima', () => {
  const dataMinima = { ancora: 'DATA_FIXA', data: '2024-02-01' };
  const dataMaxima = { ancora: 'DATA_FIXA', data: '2024-01-01' };
  expect(() => lerRestricao({ tipo: 'FAIXA_DE_DATA', dataMinima, dataMaxima }, 'r')).toThrow(
    'A data mínima fica depois',
  );
});
it('aceita data fixa válida sem deslocamento', () => {
  expect(lerLimiteDeData({ ancora: 'DATA_FIXA', data: '2024-02-29' }, 'r')).toEqual({
    ancora: 'DATA_FIXA',
    data: '2024-02-29',
  });
});
it('recusa data fixa inválida ou com deslocamento', () => {
  expect(() => lerLimiteDeData({ ancora: 'DATA_FIXA', data: '2023-02-29' }, 'r')).toThrow(
    'dia do calendário',
  );
  expect(() => lerLimiteDeData({ ancora: 'DATA_FIXA', data: '2024-01-01', dias: 1 }, 'r')).toThrow(
    'não tem deslocamento',
  );
});
it('recusa a data mínima reservada', () => {
  expect(() => lerLimiteDeData({ ancora: 'DATA_FIXA', data: '0001-01-01' }, 'r')).toThrow(
    'não pode ser 01/01/0001',
  );
});
it('lê deslocamento do envio com valores ausentes como zero', () => {
  expect(lerLimiteDeData({ ancora: 'ENVIO' }, 'r')).toEqual({ ancora: 'ENVIO', anos: 0, dias: 0 });
});
it('recusa data ou deslocamento fracionário no limite do envio', () => {
  expect(() => lerLimiteDeData({ ancora: 'ENVIO', data: '2024-01-01' }, 'r')).toThrow(
    'não tem data',
  );
  expect(() => lerLimiteDeData({ ancora: 'ENVIO', dias: 0.5 }, 'r')).toThrow('número inteiro');
});
it('recusa deslocamento além do teto e âncora desconhecida', () => {
  expect(() => lerLimiteDeData({ ancora: 'ENVIO', anos: 100000 }, 'r')).toThrow(
    'O deslocamento do dia do envio vai até',
  );
  expect(() => lerLimiteDeData({ ancora: 'OUTRA' }, 'r')).toThrow('A âncora do limite');
});
