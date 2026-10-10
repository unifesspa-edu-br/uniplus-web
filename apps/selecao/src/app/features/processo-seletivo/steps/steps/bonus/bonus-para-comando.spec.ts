import { describe, expect, it } from 'vitest';

import { WizardDraft } from '../../processo-seletivo.models';
import { comoComandoDeBonus } from './bonus-para-comando';

const BASE_LEGAL_ID = 'ba5e0000-0000-7000-8000-000000000001';

function bonus(patch: Partial<WizardDraft['bonus']>): WizardDraft['bonus'] {
  return {
    aplica: false,
    regraCodigo: '',
    regraVersao: '',
    fator: '',
    teto: '',
    baseLegalBonusRegionalId: '',
    fatoElegibilidadeCodigo: '',
    ...patch,
  };
}

describe('comoComandoDeBonus', () => {
  it('grava a declaração de que não aplica, com os campos null, quando o bônus não se aplica', () => {
    const comando = comoComandoDeBonus(
      bonus({
        aplica: false,
        // Resíduo de uma edição anterior — a ausência declarada não pode vazar.
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        fator: '1.2',
        fatoElegibilidadeCodigo: 'SOLICITA_ACRESCIMO',
      }),
    );

    expect(comando).toEqual({
      aplica: false,
      regraCodigo: null,
      regraVersao: null,
      fator: null,
      teto: null,
      baseLegalBonusRegionalId: null,
      fatoElegibilidadeCodigo: null,
    });
  });

  it('converte os campos preenchidos quando aplica', () => {
    const comando = comoComandoDeBonus(
      bonus({
        aplica: true,
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        regraVersao: '1.0',
        fator: '1,20',
        teto: '10',
        baseLegalBonusRegionalId: BASE_LEGAL_ID,
        fatoElegibilidadeCodigo: 'SOLICITA_ACRESCIMO',
      }),
    );

    expect(comando).toEqual({
      aplica: true,
      regraCodigo: 'BONUS-MULTIPLICATIVO',
      regraVersao: '1.0',
      fator: 1.2,
      teto: 10,
      baseLegalBonusRegionalId: BASE_LEGAL_ID,
      fatoElegibilidadeCodigo: 'SOLICITA_ACRESCIMO',
    });
  });

  it('teto vazio vai null — sem teto é estado válido', () => {
    const comando = comoComandoDeBonus(
      bonus({
        aplica: true,
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
      bonus({
        aplica: true,
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        regraVersao: '1.0',
        fator: '1.2',
      }),
    );

    expect(comando.baseLegalBonusRegionalId).toBeNull();
  });

  it('fato de elegibilidade ainda não escolhido vai null — a publicação é que o exige', () => {
    const comando = comoComandoDeBonus(
      bonus({
        aplica: true,
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        regraVersao: '1.0',
        fator: '1.2',
      }),
    );

    expect(comando.fatoElegibilidadeCodigo).toBeNull();
  });

  it('não grava enquanto a declaração não foi respondida', () => {
    expect(() => comoComandoDeBonus(bonus({ aplica: null }))).toThrow(
      'A declaração do bônus regional precisa ser respondida',
    );
  });
});
