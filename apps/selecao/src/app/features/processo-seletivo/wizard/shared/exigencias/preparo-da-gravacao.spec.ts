import { describe, expect, it } from 'vitest';

import { comExigidoDeTodos, comModalidades } from './modalidades-da-exigencia';
import {
  condicoesDaExigencia,
  etapaDeColetaValida,
  formularioDoDocumento,
} from './preparo-da-gravacao';
import {
  CHAVE_ETAPA_RENDA,
  ETAPAS_POR_CHAVE,
  ID_ETAPA_RENDA,
  exigencia,
} from './exigencias.testing';

describe('etapaDeColetaValida', () => {
  it('acha o identificador da etapa pela chave', () => {
    const documento = exigencia({ etapaChave: CHAVE_ETAPA_RENDA });
    expect(etapaDeColetaValida(documento, ETAPAS_POR_CHAVE)).toBe(ID_ETAPA_RENDA);
  });

  it('devolve o documento à fase inteira quando o documento não tem etapa', () => {
    expect(etapaDeColetaValida(exigencia({ etapaChave: null }), ETAPAS_POR_CHAVE)).toBeNull();
  });

  it('devolve o documento à fase inteira quando a etapa saiu do processo', () => {
    const documento = exigencia({ etapaChave: 'etapa_removida' });
    expect(etapaDeColetaValida(documento, ETAPAS_POR_CHAVE)).toBeNull();
  });
});

describe('formularioDoDocumento', () => {
  it('leva o formulário herdado da regra principal', () => {
    expect(formularioDoDocumento(exigencia(), 'ISENCAO_TAXA')).toBe('ISENCAO_TAXA');
  });

  it('mantém o formulário que o documento lido do servidor já tinha', () => {
    const lido = exigencia({ faseIdLido: 'fase-fora', formularioCodigo: 'INSCRICAO' });
    expect(formularioDoDocumento(lido, 'ISENCAO_TAXA')).toBe('INSCRICAO');
  });

  it('não leva código quando nenhum formulário está definido', () => {
    expect(formularioDoDocumento(exigencia(), null)).toBe('');
  });
});

describe('condicoesDaExigencia', () => {
  it('não leva condição quando a exigência é de todos', () => {
    const geral = comExigidoDeTodos(exigencia(), true);
    expect(condicoesDaExigencia(geral, ['AC'])).toEqual([]);
  });

  it('leva a restrição às modalidades quando ela existe', () => {
    const restrita = comModalidades(exigencia(), ['AC']);
    expect(condicoesDaExigencia(restrita, ['AC', 'PPI'])).toHaveLength(1);
  });

  it('leva só as condições declaradas quando não há restrição às modalidades', () => {
    const declarada = { clausula: 1, fato: 'DADO_X', operador: 'IGUAL', valor: 'A' };
    const condicional = {
      ...comModalidades(exigencia(), null),
      aplicabilidade: 'CONDICIONAL',
      condicoes: [declarada],
    };
    expect(condicoesDaExigencia(condicional, ['AC'])).toEqual([declarada]);
  });
});
