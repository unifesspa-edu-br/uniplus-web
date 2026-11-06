import { TIPOS_UNIDADE, TipoUnidade } from '@uniplus/shared-data/organizacao';
import type { UiFilterChipOption } from '@uniplus/shared-ui/components';

/**
 * Ordinal numérico do enum `TipoUnidade` no backend (`TipoUnidade.cs`), usado só pelo filtro
 * `?tipo=` da listagem. Esse parâmetro é lido pelo controller como `int[]` bruto, independente do
 * enum em string que o corpo JSON de criação e atualização usa; o enum em string não expõe o
 * ordinal em tempo de execução, então a tabela fica aqui.
 */
const ORDINAL_DO_FILTRO: Readonly<Record<TipoUnidade, number>> = {
  [TipoUnidade.nenhum]: 0,
  [TipoUnidade.reitoria]: 1,
  [TipoUnidade.proReitoria]: 2,
  [TipoUnidade.centro]: 3,
  [TipoUnidade.instituto]: 4,
  [TipoUnidade.faculdade]: 5,
  [TipoUnidade.departamento]: 6,
  [TipoUnidade.coordenacao]: 7,
  [TipoUnidade.diretoria]: 8,
  [TipoUnidade.divisao]: 9,
  [TipoUnidade.nucleo]: 10,
  [TipoUnidade.outro]: 11,
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

function normalizarRotulo(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\+/gu, 'plus')
    .replace(/[^a-z0-9]/giu, '')
    .toLocaleLowerCase('pt-BR');
}

/**
 * O valor do tipo que o backend devolveu como rótulo. Sem casamento com os 11 tipos conhecidos
 * devolve vazio (controle inválido), em vez de assumir "Outro": editar e salvar não reclassifica
 * a unidade em silêncio.
 */
export function tipoDoRotulo(rotulo: string): string {
  const alvo = normalizarRotulo(rotulo);
  return TIPOS_UNIDADE.find((tipo) => normalizarRotulo(tipo.label) === alvo)?.value ?? '';
}
