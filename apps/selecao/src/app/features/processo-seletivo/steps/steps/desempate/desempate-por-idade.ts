import { STEP_LABELS } from '../../processo-seletivo.data';
import type {
  CriterioDesempateConfigurado,
  ReferenciaTemporalConfig,
} from '../../processo-seletivo.models';

export const CRITERIO_MAIOR_IDADE = 'DESEMPATE-MAIOR-IDADE';
export const CRITERIO_IDOSO = 'DESEMPATE-IDOSO';

/** O dado pelo qual o desempate por maior idade ordena: o nascido mais cedo vence. */
export const FATO_DATA_NASCIMENTO = 'DATA_NASCIMENTO';

/** Posição dos passos que as incoerências ligam, derivada da ordem única dos passos. */
export const PASSO_DESEMPATE = STEP_LABELS.indexOf('Desempate');
export const PASSO_FORMULARIO = STEP_LABELS.indexOf('Formulário');

function declara(criterios: readonly CriterioDesempateConfigurado[], regraCodigo: string): boolean {
  return criterios.some((criterio) => criterio.regraCodigo === regraCodigo);
}

/** Se algum critério ordena pela data de nascimento do candidato. */
export function desempateUsaDataDeNascimento(
  criterios: readonly CriterioDesempateConfigurado[],
): boolean {
  return declara(criterios, CRITERIO_MAIOR_IDADE);
}

/**
 * Se o desempate por maior idade foi declarado sem que o formulário colete a data de nascimento.
 *
 * O critério ordena pelo nascido mais cedo, e sem esse dado não há com o que desempatar. Não
 * depende da política de apuração da idade: comparar duas datas de nascimento não pede um
 * instante de referência. O servidor ainda não cruza as duas declarações, então a tela avisa em
 * vez de bloquear.
 */
export function desempateSemDataDeNascimento(
  criterios: readonly CriterioDesempateConfigurado[],
  fatosColetados: ReadonlySet<string>,
): boolean {
  return desempateUsaDataDeNascimento(criterios) && !fatosColetados.has(FATO_DATA_NASCIMENTO);
}

/**
 * Se o desempate por idoso foi declarado sem que o formulário apure a idade.
 *
 * Esse critério compara a faixa etária com a idade mínima, e a faixa etária só existe contra um
 * instante: sem a política de apuração, ele não tem como avaliar quem é idoso.
 */
export function desempateIdosoSemApuracao(
  criterios: readonly CriterioDesempateConfigurado[],
  referencia: ReferenciaTemporalConfig,
): boolean {
  return referencia.tipo === '' && declara(criterios, CRITERIO_IDOSO);
}
