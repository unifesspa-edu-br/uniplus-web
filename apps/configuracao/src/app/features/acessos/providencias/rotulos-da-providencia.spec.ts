import { describe, expect, it } from 'vitest';
import {
  FILTROS_DA_FILA,
  TIPOS_DA_PROVIDENCIA,
  encerramentoDaConcessao,
  situacaoDaProvidencia,
  tipoDaProvidencia,
} from './rotulos-da-providencia';

describe('rótulos da providência', () => {
  it('nomeia as quatro situações como o contrato', () => {
    expect(
      (['aberta', 'respondida', 'atendida', 'prejudicada'] as const).map(
        (s) => situacaoDaProvidencia(s).texto,
      ),
    ).toEqual(['Aberta', 'Respondida', 'Atendida', 'Prejudicada']);
  });

  it('nomeia os tipos e as causas do encerramento como o contrato', () => {
    expect(tipoDaProvidencia('retirada')).toBe('Retirada do acesso');
    expect(tipoDaProvidencia('revisao')).toBe('Revisão do acesso');
    expect(encerramentoDaConcessao('revogada')).toBe('Concessão revogada');
    expect(encerramentoDaConcessao('vencida')).toBe('Concessão vencida');
  });

  it('o filtro da fila começa pelas abertas e termina em todas', () => {
    expect(FILTROS_DA_FILA.map((f) => f.valor)).toEqual([
      'aberta',
      'respondida',
      'atendida',
      'prejudicada',
      'todas',
    ]);
    expect(TIPOS_DA_PROVIDENCIA.map((t) => t.valor)).toEqual(['retirada', 'revisao']);
  });
});
