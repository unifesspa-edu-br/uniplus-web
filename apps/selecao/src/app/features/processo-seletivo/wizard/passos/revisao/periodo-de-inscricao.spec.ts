import { describe, expect, it } from 'vitest';

import { congeladosBase, draftVazio, fase } from './publicacao.testing';
import {
  dataReferenciaLegalDe,
  faseQueAncoraOPeriodoDeInscricao,
  temFaseDeColetaInscricao,
} from './periodo-de-inscricao';

describe('faseQueAncoraOPeriodoDeInscricao / temFaseDeColetaInscricao', () => {
  it('devolve null quando nenhuma fase coleta inscrição', () => {
    const draft = draftVazio();
    draft.cronograma.fases = [
      fase({ ordem: 1, congelados: { ...congeladosBase, coletaInscricao: false } }),
    ];

    expect(faseQueAncoraOPeriodoDeInscricao(draft)).toBeNull();
    expect(temFaseDeColetaInscricao(draft)).toBe(false);
  });

  it('elege a fase de MENOR ordem entre as que coletam — duas fases de coleta não é problema da tela', () => {
    const draft = draftVazio();
    draft.cronograma.fases = [
      fase({
        ordem: 2,
        codigo: 'REMANEJAMENTO',
        congelados: { ...congeladosBase, coletaInscricao: true },
        inicio: '2027-02-01T00:00:00Z',
        fim: '2027-02-10T23:59:59Z',
      }),
      fase({
        ordem: 1,
        codigo: 'INSCRICAO',
        congelados: { ...congeladosBase, coletaInscricao: true },
        inicio: '2027-01-01T00:00:00Z',
        fim: '2027-01-31T23:59:59Z',
      }),
    ];

    const ancora = faseQueAncoraOPeriodoDeInscricao(draft);
    expect(ancora?.codigo).toBe('INSCRICAO');
    expect(temFaseDeColetaInscricao(draft)).toBe(true);
  });
});

describe('dataReferenciaLegalDe', () => {
  it('usa o início da fase de coleta quando ela já tem janela', () => {
    const draft = draftVazio();
    draft.cronograma.fases = [
      fase({
        ordem: 1,
        congelados: { ...congeladosBase, coletaInscricao: true },
        inicio: '2027-01-01T02:00:00Z',
        fim: '2027-01-31T23:59:59Z',
      }),
    ];

    expect(dataReferenciaLegalDe(draft)).toBe('2026-12-31');
  });

  it('devolve null quando a fase de coleta ainda não tem janela', () => {
    const draft = draftVazio();
    draft.cronograma.fases = [
      fase({ ordem: 1, congelados: { ...congeladosBase, coletaInscricao: true } }),
    ];

    expect(dataReferenciaLegalDe(draft)).toBeNull();
  });

  it('sem fase de coleta, usa o que o operador informou no campo desta tela', () => {
    const draft = draftVazio();
    draft.publicacao.periodoInscricaoInicio = '2027-03-10T09:00';

    expect(dataReferenciaLegalDe(draft)).toBe('2027-03-10');
  });

  it('sem fase de coleta e sem campo preenchido, devolve null', () => {
    expect(dataReferenciaLegalDe(draftVazio())).toBeNull();
  });
});
