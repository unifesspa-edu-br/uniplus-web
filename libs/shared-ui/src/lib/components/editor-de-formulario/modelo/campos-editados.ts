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

export function camposDaMudanca(mudanca: object): CamposEditadosDoFormulario {
  return Object.keys(mudanca).map((campo) => [campo]);
}

export function camposNaParte(
  prefixo: CaminhoDoCampo,
  campos: CamposEditadosDoFormulario,
): CamposEditadosDoFormulario {
  return campos.map((campo) => [...prefixo, ...campo]);
}

/** A inclusão também confirma as condições do parentesco e a ordem dos campos do grupo. */
export function camposDaInclusaoDoCandidato(grupo: GrupoDoFormulario): CamposEditadosDoFormulario {
  const ordens = grupo.subitens.map((item) => ['subitens', item.fatoCodigo, 'ordem']);
  const parentesco = ['subitens', FATO_PARENTESCO];
  const campos = ['precondicao', 'obrigatoriedade', 'predicadoObrigatoriedade', 'restricoes'];
  return [
    ['incluiCandidato'],
    ['minimo'],
    ...ordens,
    ...campos.map((campo) => [...parentesco, campo]),
  ];
}
