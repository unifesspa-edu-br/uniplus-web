import { UnidadePrazo } from '@uniplus/shared-data/selecao';

import { decimalDoCampo } from './numero-do-campo';

/** Uma unidade que o operador escolhe, com o nome no plural (rótulo) e no singular. */
export interface UnidadeDePrazoDoRecurso {
  readonly valor: UnidadePrazo;
  readonly rotulo: string;
  readonly singular: string;
}

const DIAS_UTEIS: UnidadeDePrazoDoRecurso = {
  valor: UnidadePrazo.diasUteis,
  rotulo: 'dias úteis',
  singular: 'dia útil',
};
const DIAS_CORRIDOS: UnidadeDePrazoDoRecurso = {
  valor: UnidadePrazo.dias,
  rotulo: 'dias corridos',
  singular: 'dia corrido',
};
const HORAS: UnidadeDePrazoDoRecurso = {
  valor: UnidadePrazo.horas,
  rotulo: 'horas',
  singular: 'hora',
};

/** Dia corrido fica fora da interposição porque a API o recusa ali. */
export const UNIDADES_DA_INTERPOSICAO: readonly UnidadeDePrazoDoRecurso[] = [DIAS_UTEIS, HORAS];

/** A suspensividade é outro relógio e admite as três unidades (UNI-REQ-0080). */
export const UNIDADES_DA_SUSPENSIVIDADE: readonly UnidadeDePrazoDoRecurso[] = [
  DIAS_UTEIS,
  DIAS_CORRIDOS,
  HORAS,
];

/** O par valor e unidade em texto, com a unidade concordando em número; sem valor, vazio. */
export function prazoEmTexto(valor: string, unidade: string): string {
  if (valor.trim() === '') return '';
  const conhecida = UNIDADES_DA_SUSPENSIVIDADE.find((candidata) => candidata.valor === unidade);
  if (conhecida === undefined) return `${valor} ${unidade}`;
  return `${valor} ${decimalDoCampo(valor) === 1 ? conhecida.singular : conhecida.rotulo}`;
}
