import { describe, expect, it } from 'vitest';

import { WizardDraft } from '../../processo-seletivo.models';
import { comoComandoDeBonus } from './bonus-para-comando';

const BASE_LEGAL_ID = 'ba5e0000-0000-7000-8000-000000000001';

function bonus(patch: Partial<WizardDraft['bonus']>): WizardDraft['bonus'] {
  return {
    ativo: false,
    regraCodigo: '',
    regraVersao: '',
    fator: '',
    teto: '',
    baseLegalBonusRegionalId: '',
    ...patch,
  };
}

describe('comoComandoDeBonus', () => {
  it('grava os cinco campos null quando o bônus não está ativo (toggle por presença)', () => {
    const comando = comoComandoDeBonus(
      bonus({
        ativo: false,
        // Resíduo de uma edição anterior — a ausência declarada não pode vazar.
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        fator: '1.2',
      }),
    );

    expect(comando).toEqual({
      regraCodigo: null,
      regraVersao: null,
      fator: null,
      teto: null,
      baseLegalBonusRegionalId: null,
    });
  });

  it('converte os campos preenchidos quando ativo', () => {
    const comando = comoComandoDeBonus(
      bonus({
        ativo: true,
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        regraVersao: '1.0',
        fator: '1,20',
        teto: '10',
        baseLegalBonusRegionalId: BASE_LEGAL_ID,
      }),
    );

    expect(comando).toEqual({
      regraCodigo: 'BONUS-MULTIPLICATIVO',
      regraVersao: '1.0',
      fator: 1.2,
      teto: 10,
      baseLegalBonusRegionalId: BASE_LEGAL_ID,
    });
  });

  it('teto vazio vai null — sem teto é estado válido', () => {
    const comando = comoComandoDeBonus(
      bonus({
        ativo: true,
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        regraVersao: '1.0',
        fator: '1.2',
        teto: '',
      }),
    );

    expect(comando.teto).toBeNull();
  });

  it('base legal vazia vai null — CA-04, sem default inventado', () => {
    const comando = comoComandoDeBonus(
      bonus({ ativo: true, regraCodigo: 'BONUS-MULTIPLICATIVO', regraVersao: '1.0', fator: '1.2' }),
    );

    expect(comando.baseLegalBonusRegionalId).toBeNull();
  });
});
