import { expect, it } from 'vitest';
import {
  limitesDaFaixaDeData,
  mensagensDasRestricoes,
  textoDosLimitesDeData,
} from './mensagens-das-restricoes';

it('informa os dois limites de data em formato brasileiro', () => {
  expect(textoDosLimitesDeData({ minimo: '2024-01-02', maximo: '2024-12-31' })).toBe(
    'Informe uma data entre 02/01/2024 e 31/12/2024.',
  );
});

it('informa o limite mínimo quando não há máximo', () => {
  expect(textoDosLimitesDeData({ minimo: '2024-01-02', maximo: null })).toBe(
    'Informe uma data a partir de 02/01/2024.',
  );
});

it('informa o limite máximo quando não há mínimo', () => {
  expect(textoDosLimitesDeData({ minimo: null, maximo: '2024-12-31' })).toBe(
    'Informe uma data até 31/12/2024.',
  );
});

it('não apresenta limites de data quando não há regra', () => {
  expect(limitesDaFaixaDeData(null, null)).toBeNull();
  expect(textoDosLimitesDeData(null)).toBeNull();
});

it('apresenta mensagens específicas para opções e municípios', () => {
  expect(
    mensagensDasRestricoes(
      ['OPCOES_PERMITIDAS', 'OPCOES_DAS_RESPOSTAS', 'MUNICIPIOS_DA_UF'],
      null,
      null,
    ),
  ).toEqual([
    'Escolha uma das opções oferecidas.',
    'Escolha uma das opções oferecidas.',
    'Escolha um município da UF informada.',
  ]);
});

it('usa mensagens genéricas para regra, formato e data desconhecidos', () => {
  expect(mensagensDasRestricoes(['OUTRA', 'FORMATO_TEXTO', 'FAIXA_DE_DATA'], null, null)).toEqual([
    'A resposta não atende à regra do campo.',
    'A resposta não está no formato esperado.',
    'A data não está dentro dos limites do campo.',
  ]);
});

it('usa zero como limite quando a restrição numérica ou de texto está ausente', () => {
  expect(mensagensDasRestricoes(['FAIXA_NUMERICA', 'TAMANHO_TEXTO'], null, null)).toEqual([
    'Informe um número igual ou menor que 0.',
    'Escreva no máximo 0 caracteres.',
  ]);
});
