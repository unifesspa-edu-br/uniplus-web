import { CaraterEtapa } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import type { RegraEliminacaoConfigurada } from '../../processo-seletivo.models';
import { mensagensDasRegras } from './validacao-da-eliminacao';
import type { EtapaReferenciavel } from './regras-de-eliminacao';

const ETAPA: EtapaReferenciavel = {
  id: 'etapa-1',
  nome: 'Prova objetiva',
  carater: CaraterEtapa.classificatoria,
  tipoEtapaOrigemId: 'tipo-1',
  peso: '1',
  notaMinima: '',
  ordem: 1,
  faseCodigo: '',
  produtos: [],
  inicio: '',
  fim: '',
  emiteParecerIndividual: false,
  bancas: [],
  recursos: [],
  doEnem: false,
};

const SEM_QUADRO = { areas: null, grupos: [], rotulos: new Map<string, string>() };

function regra(patch: Partial<RegraEliminacaoConfigurada>): RegraEliminacaoConfigurada {
  return {
    regraCodigo: '',
    regraVersao: '1.0',
    etapaRef: '',
    notaMinima: '',
    minimo: '',
    areaCodigo: '',
    ...patch,
  };
}

function conferir(regras: RegraEliminacaoConfigurada[], baseadoEmEnem = false): string {
  return mensagensDasRegras({
    regras,
    etapas: [ETAPA],
    quadro: SEM_QUADRO,
    baseadoEmEnem,
  }).join(' ');
}

describe('mensagensDasRegras', () => {
  describe('ELIM-NOTA-MINIMA-ETAPA — exige etapaRef e notaMinima', () => {
    const NOTA = regra({ regraCodigo: 'ELIM-NOTA-MINIMA-ETAPA' });

    it('recusa sem etapaRef nem notaMinima', () => {
      expect(conferir([NOTA])).not.toBe('');
    });

    it('recusa quando a etapa referenciada não existe mais no cronograma', () => {
      expect(conferir([{ ...NOTA, etapaRef: 'etapa-removida', notaMinima: '5' }])).toContain(
        'não existe mais',
      );
    });

    it('aceita com etapaRef existente e notaMinima informada', () => {
      expect(conferir([{ ...NOTA, etapaRef: 'etapa-1', notaMinima: '5' }])).toBe('');
    });
  });

  describe('ELIM-ZERO-EM-AREA — não usa argumento', () => {
    const ZERO = regra({ regraCodigo: 'ELIM-ZERO-EM-AREA' });

    it('recusa sem baseadoEmEnem — a exigência não é exclusiva do corte por área', () => {
      expect(conferir([ZERO])).toContain('baseada em ENEM');
    });

    it('aceita sem etapaRef, notaMinima nem minimo, desde que baseadoEmEnem', () => {
      expect(conferir([ZERO], true)).toBe('');
    });
  });

  describe('ELIM-FALTA-EM-DIA-DE-PROVA-ENEM — sem argumento e uma só vez', () => {
    const FALTA = regra({ regraCodigo: 'ELIM-FALTA-EM-DIA-DE-PROVA-ENEM' });

    it('mostra a pendência sem baseadoEmEnem, antes de gravar', () => {
      expect(conferir([FALTA])).toContain('baseada em ENEM');
    });

    it('aceita uma vez, com baseadoEmEnem', () => {
      expect(conferir([FALTA], true)).toBe('');
    });

    it('mostra a pendência quando a regra é declarada duas vezes', () => {
      const mensagens = conferir([FALTA, FALTA], true);
      expect(mensagens).toContain('Regra de eliminação 2');
      expect(mensagens).toContain('já foi declarada');
    });
  });
});
