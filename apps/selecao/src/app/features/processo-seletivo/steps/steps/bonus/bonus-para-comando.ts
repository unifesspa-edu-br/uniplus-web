import { DefinirBonusRegionalRequest } from '@uniplus/shared-data/selecao';

import { WizardDraft } from '../../processo-seletivo.models';

/** Texto vazio vira `null` — a forma de "não informado" no comando. */
function naoVazio(texto: string): string | null {
  const limpo = texto.trim();
  return limpo === '' ? null : limpo;
}

/** Vírgula ou ponto como separador decimal — a mesma gramática do resto do wizard. */
function decimal(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(limpo) ? Number(limpo) : null;
}

/**
 * Converte o rascunho de bônus no `DefinirBonusRegionalRequest`. Toggle por
 * presença (RN05, INV-B5): `ativo === false` grava os cinco campos `null` —
 * é assim que "sem bônus" se declara, não existe rota separada para
 * desligá-lo. CA-04: nenhum default é inventado quando ativo.
 */
export function comoComandoDeBonus(bonus: WizardDraft['bonus']): DefinirBonusRegionalRequest {
  if (!bonus.ativo) {
    return {
      regraCodigo: null,
      regraVersao: null,
      fator: null,
      teto: null,
      municipioConvenio: null,
      baseLegal: null,
    };
  }

  return {
    regraCodigo: naoVazio(bonus.regraCodigo),
    regraVersao: naoVazio(bonus.regraVersao),
    fator: decimal(bonus.fator),
    teto: naoVazio(bonus.teto) === null ? null : decimal(bonus.teto),
    municipioConvenio: naoVazio(bonus.municipioConvenio),
    baseLegal: naoVazio(bonus.baseLegal),
  };
}
