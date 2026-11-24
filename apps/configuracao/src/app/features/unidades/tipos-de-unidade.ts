import { TIPOS_UNIDADE, TipoUnidadeCodigo } from '@uniplus/shared-data/organizacao';
import type { UiFilterChipOption } from '@uniplus/shared-ui/components';

/**
 * Ordinal numérico do tipo no backend, usado só pelo filtro `?tipo=` da listagem. Esse parâmetro
 * é lido pelo controller como número, independente do código de texto que o corpo de criação e
 * de atualização envia; o código não expõe o ordinal, então a tabela fica aqui.
 */
const ORDINAL_DO_FILTRO: Readonly<Record<TipoUnidadeCodigo, number>> = {
  [TipoUnidadeCodigo.REITORIA]: 1,
  [TipoUnidadeCodigo.PRO_REITORIA]: 2,
  [TipoUnidadeCodigo.CENTRO]: 3,
  [TipoUnidadeCodigo.INSTITUTO]: 4,
  [TipoUnidadeCodigo.FACULDADE]: 5,
  [TipoUnidadeCodigo.DEPARTAMENTO]: 6,
  [TipoUnidadeCodigo.COORDENACAO]: 7,
  [TipoUnidadeCodigo.DIRETORIA]: 8,
  [TipoUnidadeCodigo.DIVISAO]: 9,
  [TipoUnidadeCodigo.NUCLEO]: 10,
  [TipoUnidadeCodigo.OUTRO]: 11,
};

/** Os 11 tipos do domínio fechado, como o select do formulário os oferece. */
export const OPCOES_DE_TIPO = TIPOS_UNIDADE.map((tipo) => ({
  value: tipo.value,
  label: tipo.label,
}));

/**
 * Chips de tipo do filtro. O `value` é o ordinal em texto: vira o `?tipo=` da consulta. Sem
 * contagem por tipo, que exigiria facetas que o backend não expõe.
 */
export const CHIPS_DE_TIPO: readonly UiFilterChipOption[] = [
  { value: '', label: 'Todas' },
  ...TIPOS_UNIDADE.map((tipo) => ({
    value: String(ORDINAL_DO_FILTRO[tipo.value]),
    label: tipo.label,
  })),
];

export function rotuloDoTipo(codigo: TipoUnidadeCodigo): string {
  return TIPOS_UNIDADE.find((tipo) => tipo.value === codigo)?.label ?? codigo;
}
