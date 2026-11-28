import { codigoComNome } from '@uniplus/shared-utils';

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
 * Como cada modalidade que o processo aceita aparece na tela: "código — nome", ou só o código
 * quando não há nome. A chave continua sendo o código; a primeira oferta que cita a modalidade
 * define o rótulo.
 */
export function rotulosDasModalidades(draft: WizardDraft): ReadonlyMap<string, string> {
  const rotulos = new Map<string, string>();
  for (const oferta of draft.vagas.ofertas) {
    for (const modalidade of oferta.modalidades) {
      if (!rotulos.has(modalidade.codigo)) {
        rotulos.set(modalidade.codigo, codigoComNome(modalidade.codigo, modalidade.nome));
      }
    }
  }
  return rotulos;
}

/**
 * Concorrência dupla (Lei 14.723/2023) vale quando o processo oferece cota reservada. É
 * consequência das modalidades, não opção, e o servidor a computa do mesmo modo em
 * `ConcorrenciaDuplaAplicavel`.
 */
export function concorrenciaDuplaAplicavel(modalidades: readonly string[]): boolean {
  return modalidades.some((codigo) => codigo.startsWith('LB_') || codigo.startsWith('LI_'));
}
