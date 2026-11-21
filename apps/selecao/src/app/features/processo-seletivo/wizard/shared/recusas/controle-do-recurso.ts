import type { CampoDosParametros } from '../configuracao-do-recurso/parametros-do-recurso';

/**
 * Os controles da configuração do recurso que uma recusa da API pode apontar: um por campo da
 * API, porque valor e unidade são dois controles e a recusa de um não pode marcar o outro.
 * `origemDoPrazo` é a escolha entre contar da publicação ou da ciência, que só o recurso da etapa
 * tem; `ancora` é a publicação de que o prazo corre.
 */
export type ControleDoRecurso =
  | 'regra'
  | 'prazoValor'
  | 'prazoUnidade'
  | 'origemDoPrazo'
  | 'ancora'
  | 'admiteInstanciaSuperior'
  | 'efeitoSuspensivo'
  | 'guardaDaVaga'
  | 'prazoSegundaInstanciaValor'
  | 'prazoSegundaInstanciaUnidade';

const CONTROLES: readonly (readonly [string, ControleDoRecurso])[] = [
  ['regraCodigo', 'regra'],
  ['regraVersao', 'regra'],
  ['prazoValor', 'prazoValor'],
  ['prazoUnidade', 'prazoUnidade'],
  ['ancora', 'origemDoPrazo'],
  ['atoAncoraCodigo', 'ancora'],
  ['admiteInstanciaSuperior', 'admiteInstanciaSuperior'],
  ['efeitoSuspensivo', 'efeitoSuspensivo'],
  ['guardaDaVaga', 'guardaDaVaga'],
  ['prazoSegundaInstanciaValor', 'prazoSegundaInstanciaValor'],
  ['prazoSegundaInstanciaUnidade', 'prazoSegundaInstanciaUnidade'],
];

const CONTROLE_POR_CAMPO: ReadonlyMap<string, ControleDoRecurso> = new Map(
  CONTROLES.map(([campo, controle]) => [campo.toLowerCase(), controle]),
);

/**
 * O controle da configuração do recurso que o campo recusado nomeia (`prazoValor`,
 * `prazoSegundaInstanciaUnidade`...), ou `null` quando o campo não tem controle próprio.
 * Vale para a regra de recurso da fase e para cada recurso da etapa.
 */
export function controleDoRecurso(campo: string): ControleDoRecurso | null {
  return CONTROLE_POR_CAMPO.get(campo.toLowerCase()) ?? null;
}

const PARAMETROS: ReadonlySet<string> = new Set([
  'prazoValor',
  'prazoUnidade',
  'admiteInstanciaSuperior',
  'efeitoSuspensivo',
  'guardaDaVaga',
  'prazoSegundaInstanciaValor',
  'prazoSegundaInstanciaUnidade',
]);

/** O controle é um dos parâmetros que o componente comum da configuração do recurso mostra. */
export function ehParametroDoRecurso(controle: string): controle is CampoDosParametros {
  return PARAMETROS.has(controle);
}

/** O controle é do prazo da 2ª instância, que só aparece quando a configuração o mostra. */
export function ehDoPrazoDaSegundaInstancia(controle: string): boolean {
  return controle.startsWith('prazoSegundaInstancia');
}
