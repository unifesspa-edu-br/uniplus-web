import type { CampoDosParametros } from '../../shared/configuracao-do-recurso/parametros-do-recurso';

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

/** O prefixo dos `id` dos parâmetros da regra de recurso da fase, único por fase. */
export function prefixoDoRecursoDaFase(faseCanonicaId: string): string {
  return `recurso-fase-${faseCanonicaId}`;
}

/** O controle da regra de recurso, fora dos parâmetros, que cada campo recusado nomeia. */
export const CONTROLE_DO_RECURSO: ReadonlyMap<string, string> = new Map([
  ['recurso.regra', 'regra'],
  ['recurso.ancora', 'ancora'],
]);

/** O parâmetro do recurso que cada campo recusado nomeia, mostrado pelo componente comum. */
export const PARAMETRO_DO_RECURSO: ReadonlyMap<string, CampoDosParametros> = new Map([
  ['recurso.prazoValor', 'prazoValor'],
  ['recurso.prazoUnidade', 'prazoUnidade'],
  ['recurso.admiteInstanciaSuperior', 'admiteInstanciaSuperior'],
  ['recurso.efeitoSuspensivo', 'efeitoSuspensivo'],
  ['recurso.guardaDaVaga', 'guardaDaVaga'],
  ['recurso.prazoSegundaInstanciaValor', 'prazoSegundaInstanciaValor'],
  ['recurso.prazoSegundaInstanciaUnidade', 'prazoSegundaInstanciaUnidade'],
]);

/** Os campos da regra de recurso que têm controle próprio na tela. */
export const CAMPOS_DO_RECURSO_COM_CONTROLE: ReadonlySet<string> = new Set([
  ...CONTROLE_DO_RECURSO.keys(),
  ...PARAMETRO_DO_RECURSO.keys(),
]);

/** O sufixo do bloco que reúne as recusas de um campo da regra de recurso, ligado só ao controle dele. */
export function sufixoDaRecusaDoRecurso(campo: string): string {
  return `recusa-${campo.replace('.', '-')}`;
}
