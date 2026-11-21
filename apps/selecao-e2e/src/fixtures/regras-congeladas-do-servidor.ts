import type { CriterioDesempateDto, ReferenciaRegraDto } from '@uniplus/shared-data/selecao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

/** A referência congelada de uma regra do catálogo, como o detalhe do processo a devolve. */
export function referencia(codigo: string): JsonDaApi<ReferenciaRegraDto> {
  return { codigo, versao: '1.0', hash: `hash-${codigo}` };
}

/** Os parâmetros de um critério de desempate que não pede nenhum valor, como a maior idade. */
export const PARAMETROS_DO_DESEMPATE_SEM_VALOR: JsonDaApi<CriterioDesempateDto['parametros']> = {
  etapaRef: null,
  idadeMinima: null,
  fato: null,
  operador: null,
  valor: null,
  areas: null,
};
