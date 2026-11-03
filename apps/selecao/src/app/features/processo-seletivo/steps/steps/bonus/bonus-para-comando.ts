import { DefinirBonusRegionalRequest } from '@uniplus/shared-data/selecao';

import { WizardDraft } from '../../processo-seletivo.models';
import { decimalNaForma } from '../../shared/numero-do-campo';

/** Texto vazio vira `null` — a forma de "não informado" no comando. */
function naoVazio(texto: string): string | null {
  const limpo = texto.trim();
  return limpo === '' ? null : limpo;
}

/**
 * Converte o rascunho de bônus no `DefinirBonusRegionalRequest`. A declaração é obrigatória: só
 * se grava depois de o operador responder se o processo aplica o bônus. `aplica === false` grava
 * a declaração com os campos `null` — o servidor recusa qualquer campo do bônus nesse caso.
 * Nenhum default é inventado quando aplica.
 */
export function comoComandoDeBonus(bonus: WizardDraft['bonus']): DefinirBonusRegionalRequest {
  if (bonus.aplica === null) {
    throw new Error('A declaração do bônus regional precisa ser respondida antes de gravar.');
  }

  if (!bonus.aplica) {
    return {
      aplica: false,
      regraCodigo: null,
      regraVersao: null,
      fator: null,
      teto: null,
      baseLegalBonusRegionalId: null,
      fatoElegibilidadeCodigo: null,
    };
  }

  return {
    aplica: true,
    regraCodigo: naoVazio(bonus.regraCodigo),
    regraVersao: naoVazio(bonus.regraVersao),
    fator: decimalNaForma(bonus.fator),
    teto: naoVazio(bonus.teto) === null ? null : decimalNaForma(bonus.teto),
    baseLegalBonusRegionalId: naoVazio(bonus.baseLegalBonusRegionalId),
    fatoElegibilidadeCodigo: naoVazio(bonus.fatoElegibilidadeCodigo),
  };
}
