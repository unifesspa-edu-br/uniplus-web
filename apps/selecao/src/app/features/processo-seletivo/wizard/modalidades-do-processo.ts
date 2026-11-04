import type { WizardDraft } from './processo-seletivo.models';

/**
 * Modalidades que o processo aceita: a união do que as distribuições de vagas selecionam. Não são
 * escolha própria do processo, porque modalidade participa da distribuição de cada oferta.
 */
export function modalidadesDasOfertas(draft: WizardDraft): readonly string[] {
  const codigos = draft.vagas.ofertas.flatMap((oferta) =>
    oferta.modalidades.map((modalidade) => modalidade.codigo),
  );
  return [...new Set(codigos)];
}

/**
 * Concorrência dupla (Lei 14.723/2023) vale quando o processo oferece cota reservada. É
 * consequência das modalidades, não opção, e o servidor a computa do mesmo modo em
 * `ConcorrenciaDuplaAplicavel`.
 */
export function concorrenciaDuplaAplicavel(modalidades: readonly string[]): boolean {
  return modalidades.some((codigo) => codigo.startsWith('LB_') || codigo.startsWith('LI_'));
}
