import { TipoUnidade } from '@uniplus/shared-data/organizacao';
import { describe, expect, it } from 'vitest';
import { CHIPS_DE_TIPO, OPCOES_DE_TIPO, tipoDoRotulo } from './tipos-de-unidade';

describe('tipos-de-unidade', () => {
  it('oferece os 11 tipos e um chip "Todas" mais um por tipo, com ordinais distintos', () => {
    expect(OPCOES_DE_TIPO).toHaveLength(11);
    expect(CHIPS_DE_TIPO[0]).toEqual({ value: '', label: 'Todas' });
    const ordinais = CHIPS_DE_TIPO.slice(1).map((chip) => chip.value);
    expect(new Set(ordinais).size).toBe(11);
    expect(ordinais).not.toContain('0');
  });

  it('resolve o rótulo do backend ignorando acento e caixa', () => {
    expect(tipoDoRotulo('Reitoria')).toBe(TipoUnidade.reitoria);
    expect(tipoDoRotulo('NUCLEO')).toBe(TipoUnidade.nucleo);
    expect(tipoDoRotulo('Pró-Reitoria')).toBe(TipoUnidade.proReitoria);
  });

  it('rótulo desconhecido devolve vazio', () => {
    expect(tipoDoRotulo('Galáxia')).toBe('');
  });
});
