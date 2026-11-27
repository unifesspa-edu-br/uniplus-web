import type { RegraDeHomologacao } from '../../../modelos/homologacao.models';
import type { RecusaOrdenada } from '../../../shared/recusas/ordem-das-recusas';
import { lugarNaHomologacao, PREFIXO_DA_HOMOLOGACAO } from './campo-da-homologacao';

/** A alternativa e a condição que o campo cita ainda existem na regra. */
function lugarExiste(regra: RegraDeHomologacao, campo: string): boolean {
  const { alternativa, condicao } = lugarNaHomologacao(campo);
  if (alternativa === null) return true;
  const citada = regra.alternativas[alternativa];
  return citada !== undefined && (condicao === null || citada.condicoes[condicao] !== undefined);
}

/**
 * As recusas que ficam no alto da regra: as à regra inteira, as que a pessoa já tocou por baixo e
 * serão conferidas de novo, e as que apontam uma alternativa ou condição que já não existe.
 */
export function recusasDoAltoDaRegra(
  recusas: readonly RecusaOrdenada[],
  regra: RegraDeHomologacao,
): readonly RecusaOrdenada[] {
  return recusas.filter(
    (recusa) =>
      recusa.aConferir ||
      recusa.campo === PREFIXO_DA_HOMOLOGACAO ||
      !lugarExiste(regra, recusa.campo),
  );
}

/** As recusas ainda vigentes a um campo da regra. */
export function recusasDoCampoDaHomologacao(
  recusas: readonly RecusaOrdenada[],
  campo: string,
): readonly RecusaOrdenada[] {
  return recusas.filter((recusa) => recusa.campo === campo && !recusa.aConferir);
}
