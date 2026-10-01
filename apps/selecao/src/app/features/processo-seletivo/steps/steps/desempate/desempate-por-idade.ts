import type {
  CriterioDesempateConfigurado,
  ReferenciaTemporalConfig,
} from '../../processo-seletivo.models';
import { STEP_LABELS } from '../../processo-seletivo.data';

export const CRITERIO_MAIOR_IDADE = 'DESEMPATE-MAIOR-IDADE';

/** Posição dos passos que a incoerência liga, derivada da ordem única dos passos. */
export const PASSO_DESEMPATE = STEP_LABELS.indexOf('Desempate');
export const PASSO_FORMULARIO = STEP_LABELS.indexOf('Formulário');

/**
 * Se o desempate por maior idade foi declarado sem que o formulário apure a idade.
 *
 * Sem a política temporal não há data de nascimento apurada, e o critério não tem com o que
 * desempatar. O servidor ainda não cruza as duas declarações, então a tela avisa em vez de
 * bloquear: o aviso some quando a apuração é declarada ou o critério é retirado.
 */
export function desempatePorIdadeSemApuracao(
  criterios: readonly CriterioDesempateConfigurado[],
  referencia: ReferenciaTemporalConfig,
): boolean {
  return (
    referencia.tipo === '' &&
    criterios.some((criterio) => criterio.regraCodigo === CRITERIO_MAIOR_IDADE)
  );
}
