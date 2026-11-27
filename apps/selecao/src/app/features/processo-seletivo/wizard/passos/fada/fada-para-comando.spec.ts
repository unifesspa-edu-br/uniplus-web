import { describe, expect, it } from 'vitest';

import { WizardDraft } from '../../processo-seletivo.models';
import { comoComandoDoFada } from './fada-para-comando';

const BASE_LEGAL_ID = 'ba5e0000-0000-7000-8000-000000000001';

function fada(patch: Partial<WizardDraft['fada']>): WizardDraft['fada'] {
  return {
    aplica: false,
    regraCodigo: '',
    regraVersao: '',
    fator: '',
    teto: '',
    baseLegalDoFadaId: '',
    fatoElegibilidadeCodigo: '',
    ...patch,
  };
}

describe('comoComandoDoFada', () => {
  it('grava a declaração de que não aplica, com os campos null, quando o FADA não se aplica', () => {
    const comando = comoComandoDoFada(
      fada({
        aplica: false,
        // Resíduo de uma edição anterior — a ausência declarada não pode vazar.
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        fator: '1.2',
        fatoElegibilidadeCodigo: 'SOLICITA_ACRESCIMO',
      }),
    );

    expect(comando).toEqual({
      aplica: false,
      regra: null,
      fator: null,
      teto: null,
      baseLegal: null,
      fatoElegibilidadeCodigo: null,
    });
  });

  it('converte os campos preenchidos quando aplica', () => {
    const comando = comoComandoDoFada(
      fada({
        aplica: true,
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        regraVersao: '1.0',
        fator: '1,20',
        teto: '10',
        baseLegalDoFadaId: BASE_LEGAL_ID,
        fatoElegibilidadeCodigo: 'SOLICITA_ACRESCIMO',
      }),
    );

    expect(comando).toEqual({
      aplica: true,
      regra: { codigo: 'BONUS-MULTIPLICATIVO', versao: '1.0' },
      fator: 1.2,
      teto: 10,
      baseLegal: { id: BASE_LEGAL_ID },
      fatoElegibilidadeCodigo: 'SOLICITA_ACRESCIMO',
    });
  });

  it('teto vazio vai null — sem teto é estado válido', () => {
    const comando = comoComandoDoFada(
      fada({
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
    const comando = comoComandoDoFada(
      fada({
        aplica: true,
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        regraVersao: '1.0',
        fator: '1.2',
      }),
    );

    expect(comando.baseLegal).toBeNull();
  });

  it('fato de elegibilidade ainda não escolhido vai null — a publicação é que o exige', () => {
    const comando = comoComandoDoFada(
      fada({
        aplica: true,
        regraCodigo: 'BONUS-MULTIPLICATIVO',
        regraVersao: '1.0',
        fator: '1.2',
      }),
    );

    expect(comando.fatoElegibilidadeCodigo).toBeNull();
  });

  it('não grava enquanto a declaração não foi respondida', () => {
    expect(() => comoComandoDoFada(fada({ aplica: null }))).toThrow(
      'A declaração do Fator de Atenuação precisa ser respondida',
    );
  });
});
