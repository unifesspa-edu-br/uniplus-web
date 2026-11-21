/**
 * O id de um elemento da fase, único por instância: o Cronograma embute um passo destes por fase
 * aberta, e com id fixo o rótulo, o `aria-describedby` e o `aria-controls` da segunda fase
 * apontariam para os da primeira.
 */
export function idDaFase(faseCodigo: string, sufixo: string): string {
  return `fase-${faseCodigo}-${sufixo}`;
}

/** O bloco que reúne as recusas do servidor à regra de recurso da fase. */
export const BLOCO_DAS_RECUSAS_DO_RECURSO = 'recurso-recusa';

/** O controle da regra de recurso que cada campo recusado nomeia, quando ele é um só. */
export const CONTROLE_DO_RECURSO: ReadonlyMap<string, string> = new Map([
  ['recurso.regra', 'regra'],
  ['recurso.prazoValor', 'prazo-valor'],
  ['recurso.prazoUnidade', 'prazo-unidade'],
  ['recurso.ancora', 'ancora'],
  ['recurso.suspensividadePrimeiraInstanciaValor', 'susp1-valor'],
  ['recurso.suspensividadePrimeiraInstanciaUnidade', 'susp1-unidade'],
  ['recurso.suspensividadeSegundaInstanciaValor', 'susp2-valor'],
  ['recurso.suspensividadeSegundaInstanciaUnidade', 'susp2-unidade'],
]);

/** Os campos da regra de recurso que têm controle próprio na tela, e portanto bloco próprio de recusas. */
export const CAMPOS_DO_RECURSO_COM_CONTROLE: ReadonlySet<string> = new Set([
  ...CONTROLE_DO_RECURSO.keys(),
  'recurso.admiteInstanciaSuperior',
]);

/** O sufixo do bloco que reúne as recusas de um campo da regra de recurso, ligado só ao controle dele. */
export function sufixoDaRecusaDoRecurso(campo: string): string {
  return `recusa-${campo.replace('.', '-')}`;
}
