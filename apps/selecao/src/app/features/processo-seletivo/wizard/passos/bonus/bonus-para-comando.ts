import { DefinirBonusRegionalRequest } from '@uniplus/shared-data/selecao';

import { WizardDraft } from '../../processo-seletivo.models';
import { decimalNaForma } from '../../shared/numero-do-campo';

/** Texto vazio vira `null` — a forma de "não informado" no comando. */
function naoVazio(texto: string): string | null {
  const limpo = texto.trim();
  return limpo === '' ? null : limpo;
}

function baseLegalDe(id: string): DefinirBonusRegionalRequest['baseLegal'] {
  const limpo = naoVazio(id);
  return limpo === null ? null : { id: limpo };
}

/**
 * Converte o rascunho de FADA no `DefinirBonusRegionalRequest`. A declaração é obrigatória: só
 * se grava depois de o operador responder se o processo aplica o FADA. `aplica === false` grava
 * a declaração com os campos `null` — o servidor recusa qualquer campo do FADA nesse caso.
 * Nenhum default é inventado quando aplica.
 */
export function comoComandoDeBonus(bonus: WizardDraft['bonus']): DefinirBonusRegionalRequest {
  if (bonus.aplica === null) {
    throw new Error('A declaração do FADA precisa ser respondida antes de gravar.');
  }
  return bonus.aplica ? bonusAplicado(bonus) : BONUS_NAO_APLICADO;
}

const BONUS_NAO_APLICADO: DefinirBonusRegionalRequest = {
  aplica: false,
  regra: null,
  fator: null,
  teto: null,
  baseLegal: null,
  fatoElegibilidadeCodigo: null,
};

function bonusAplicado(bonus: WizardDraft['bonus']): DefinirBonusRegionalRequest {
  return {
    aplica: true,
    regra: { codigo: naoVazio(bonus.regraCodigo), versao: naoVazio(bonus.regraVersao) },
    fator: decimalNaForma(bonus.fator),
    teto: naoVazio(bonus.teto) === null ? null : decimalNaForma(bonus.teto),
    baseLegal: baseLegalDe(bonus.baseLegalBonusRegionalId),
    fatoElegibilidadeCodigo: naoVazio(bonus.fatoElegibilidadeCodigo),
  };
}
