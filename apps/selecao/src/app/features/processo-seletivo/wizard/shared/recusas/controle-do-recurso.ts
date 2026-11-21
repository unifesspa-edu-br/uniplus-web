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
  | 'suspensividadePrimeiraInstanciaValor'
  | 'suspensividadePrimeiraInstanciaUnidade'
  | 'suspensividadeSegundaInstanciaValor'
  | 'suspensividadeSegundaInstanciaUnidade';

const CONTROLES: readonly (readonly [string, ControleDoRecurso])[] = [
  ['regraCodigo', 'regra'],
  ['regraVersao', 'regra'],
  ['prazoValor', 'prazoValor'],
  ['prazoUnidade', 'prazoUnidade'],
  ['ancora', 'origemDoPrazo'],
  ['atoAncoraCodigo', 'ancora'],
  ['admiteInstanciaSuperior', 'admiteInstanciaSuperior'],
  ['suspensividadePrimeiraInstanciaValor', 'suspensividadePrimeiraInstanciaValor'],
  ['suspensividadePrimeiraInstanciaUnidade', 'suspensividadePrimeiraInstanciaUnidade'],
  ['suspensividadeSegundaInstanciaValor', 'suspensividadeSegundaInstanciaValor'],
  ['suspensividadeSegundaInstanciaUnidade', 'suspensividadeSegundaInstanciaUnidade'],
];

const CONTROLE_POR_CAMPO: ReadonlyMap<string, ControleDoRecurso> = new Map(
  CONTROLES.map(([campo, controle]) => [campo.toLowerCase(), controle]),
);

/**
 * O controle da configuração do recurso que o campo recusado nomeia (`prazoValor`,
 * `suspensividadePrimeiraInstanciaUnidade`...), ou `null` quando o campo não tem controle próprio.
 * Vale para a regra de recurso da fase e para cada recurso da etapa.
 */
export function controleDoRecurso(campo: string): ControleDoRecurso | null {
  return CONTROLE_POR_CAMPO.get(campo.toLowerCase()) ?? null;
}

/** O controle é da segunda instância, que só existe quando o recurso admite instância superior. */
export function ehDaSegundaInstancia(controle: string): boolean {
  return controle.startsWith('suspensividadeSegundaInstancia');
}
