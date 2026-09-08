import { describe, expect, it } from 'vitest';

import { WizardDraft } from '../../processo-seletivo.models';
import { comoComandoDeBonus } from './bonus-para-comando';

function bonus(patch: Partial<WizardDraft['bonus']>): WizardDraft['bonus'] {
  return {
    ativo: false,
    regraCodigo: '',
    regraVersao: '',
    fator: '',
    teto: '',
    municipioConvenio: '',
    baseLegal: '',
    ...patch,
  };
}

describe('comoComandoDeBonus', () => {
  it('grava os cinco campos null quando o bônus não está ativo (RN05, toggle por presença)', () => {
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
      municipioConvenio: null,
      baseLegal: null,
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
        municipioConvenio: 'Marabá',
        baseLegal: 'Convênio 01/2026',
      }),
    );

    expect(comando).toEqual({
      regraCodigo: 'BONUS-MULTIPLICATIVO',
      regraVersao: '1.0',
      fator: 1.2,
      teto: 10,
      municipioConvenio: 'Marabá',
      baseLegal: 'Convênio 01/2026',
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

  it('município e base legal vazios vão null — CA-04, sem default inventado', () => {
    const comando = comoComandoDeBonus(
      bonus({ ativo: true, regraCodigo: 'BONUS-MULTIPLICATIVO', regraVersao: '1.0', fator: '1.2' }),
    );

    expect(comando.municipioConvenio).toBeNull();
    expect(comando.baseLegal).toBeNull();
  });
});
