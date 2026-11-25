import type { CodigoComRotulo } from '@uniplus/shared-ui/components';

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
  { codigo: 'ALGUM_DE', rotulo: 'é um de' },
  { codigo: 'NENHUM_DE', rotulo: 'não é nenhum de' },
];
