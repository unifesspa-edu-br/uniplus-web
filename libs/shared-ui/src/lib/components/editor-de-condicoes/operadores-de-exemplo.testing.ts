import type { CodigoComRotulo } from '../codigo-com-rotulo';

type Operadores = readonly CodigoComRotulo<string>[];

export const SO_IGUALDADE: Operadores = [
  { codigo: 'IGUAL', rotulo: 'é' },
  { codigo: 'DIFERENTE', rotulo: 'não é' },
];

export const COM_ORDEM: Operadores = [
  { codigo: 'IGUAL', rotulo: 'é igual a' },
  { codigo: 'DIFERENTE', rotulo: 'é diferente de' },
  { codigo: 'MAIOR_IGUAL', rotulo: 'é maior ou igual a' },
  { codigo: 'MENOR_IGUAL', rotulo: 'é menor ou igual a' },
];

export const COM_LISTA: Operadores = [
  ...SO_IGUALDADE,
  { codigo: 'EM', rotulo: 'é um de' },
  { codigo: 'NAO_EM', rotulo: 'não é nenhum de' },
];
