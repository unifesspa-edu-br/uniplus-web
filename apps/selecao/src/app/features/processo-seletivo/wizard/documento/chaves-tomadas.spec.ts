import type { DocumentoDaConfiguracao } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { chavesTomadas } from './chaves-tomadas';
import { documentoSemNada } from './exemplos.testing';

function comReferencias(): DocumentoDaConfiguracao {
  return {
    ...documentoSemNada(),
    etapas: [{ chave: 'prova', faseChave: 'avaliacao' }],
    documentosExigidos: {
      exigencias: [{ chave: 'rg', faseChave: 'inscricao', etapaChave: 'prova' }],
    },
    coleta: { referenciaTemporalFatos: { faseChave: 'coleta' } },
    importacao: { primeiraFaseDepoisDaImportacaoChave: 'resultado' },
  };
}

describe('chaves tomadas', () => {
  it('inclui as chaves do mesmo tipo que o chamador informa', () => {
    expect(chavesTomadas(documentoSemNada(), ['a', 'b'])).toEqual(new Set(['a', 'b']));
  });

  it('inclui toda referência a chave do documento, em qualquer profundidade', () => {
    const tomadas = chavesTomadas(comReferencias(), []);

    expect(tomadas).toEqual(new Set(['avaliacao', 'inscricao', 'prova', 'coleta', 'resultado']));
  });

  it('a chave de uma parte só conta quando o chamador a informa como do mesmo tipo', () => {
    const documento = { ...documentoSemNada(), etapas: [{ chave: 'solta' }] };

    expect(chavesTomadas(documento, []).size).toBe(0);
    expect(chavesTomadas(documento, ['solta']).has('solta')).toBe(true);
  });

  it('segue tomada a chave que só uma referência ainda cita', () => {
    const semAFase: DocumentoDaConfiguracao = {
      ...documentoSemNada(),
      cronograma: { fases: [] },
      etapas: [{ chave: 'prova', faseChave: 'fase-removida' }],
    };

    expect(chavesTomadas(semAFase, []).has('fase-removida')).toBe(true);
  });
});
