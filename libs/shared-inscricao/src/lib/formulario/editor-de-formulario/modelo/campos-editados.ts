import { FATO_PARENTESCO } from './grupos';
import type { ConteudoDoFormulario, GrupoDoFormulario } from './tipos';

/** Caminho de um campo, usando os códigos locais nas listas do formulário. */
export type CaminhoDoCampo = readonly string[];
export type CamposEditadosDoFormulario = readonly CaminhoDoCampo[];

/** O conteúdo completo e os campos confirmados pela mesma ação, mesmo sem mudar o valor. */
export interface EdicaoDoFormulario {
  readonly conteudo: ConteudoDoFormulario;
  readonly camposEditados: CamposEditadosDoFormulario;
}

/** Onde a exibição e a obrigatoriedade ficam no campo, no grupo e no termo. */
export const CAMINHO_DA_EXIBICAO: CaminhoDoCampo = ['regras', 'exibicao'];
export const CAMINHO_DO_TIPO_DA_OBRIGATORIEDADE: CaminhoDoCampo = [
  'regras',
  'obrigatoriedade',
  'tipo',
];
export const CAMINHO_DO_PREDICADO_DA_OBRIGATORIEDADE: CaminhoDoCampo = [
  'regras',
  'obrigatoriedade',
  'predicado',
];

export function camposDaMudanca(mudanca: object): CamposEditadosDoFormulario {
  return Object.keys(mudanca).map((campo) => [campo]);
}

export function camposNaParte(
  prefixo: CaminhoDoCampo,
  campos: CamposEditadosDoFormulario,
): CamposEditadosDoFormulario {
  return campos.map((campo) => [...prefixo, ...campo]);
}

const CAMPOS_DAS_REGRAS_DO_PARENTESCO: CamposEditadosDoFormulario = [
  CAMINHO_DA_EXIBICAO,
  CAMINHO_DO_TIPO_DA_OBRIGATORIEDADE,
  CAMINHO_DO_PREDICADO_DA_OBRIGATORIEDADE,
  ['regras', 'restricoes'],
];

/** A inclusão também confirma as condições do parentesco e a ordem dos campos do grupo. */
export function camposDaInclusaoDoCandidato(grupo: GrupoDoFormulario): CamposEditadosDoFormulario {
  const ordens = grupo.subitens.map((item) => ['subitens', item.fatoCodigo, 'ordem']);
  const regras = CAMPOS_DAS_REGRAS_DO_PARENTESCO.map((campo) => [
    'subitens',
    FATO_PARENTESCO,
    ...campo,
  ]);
  return [['ocorrencias', 'incluiCandidato'], ['ocorrencias', 'minimo'], ...ordens, ...regras];
}
