import {
  CausaDoEncerramento,
  SituacaoDaProvidenciaCodigo,
  TipoDaProvidencia,
} from '@uniplus/shared-data/autorizacao';
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
      (
        [
          SituacaoDaProvidenciaCodigo.ABERTA,
          SituacaoDaProvidenciaCodigo.RESPONDIDA,
          SituacaoDaProvidenciaCodigo.ATENDIDA,
          SituacaoDaProvidenciaCodigo.PREJUDICADA,
        ] as const
      ).map((s) => situacaoDaProvidencia(s).texto),
    ).toEqual(['Aberta', 'Respondida', 'Atendida', 'Prejudicada']);
  });

  it('nomeia os tipos e as causas do encerramento como o contrato', () => {
    expect(tipoDaProvidencia(TipoDaProvidencia.RETIRADA)).toBe('Retirada do acesso');
    expect(tipoDaProvidencia(TipoDaProvidencia.REVISAO)).toBe('Revisão do acesso');
    expect(encerramentoDaConcessao(CausaDoEncerramento.REVOGADA)).toBe('Concessão revogada');
    expect(encerramentoDaConcessao(CausaDoEncerramento.VENCIDA)).toBe('Concessão vencida');
  });

  it('o filtro da fila começa pelas abertas e termina em todas', () => {
    expect(FILTROS_DA_FILA.map((f) => f.valor)).toEqual([
      SituacaoDaProvidenciaCodigo.ABERTA,
      SituacaoDaProvidenciaCodigo.RESPONDIDA,
      SituacaoDaProvidenciaCodigo.ATENDIDA,
      SituacaoDaProvidenciaCodigo.PREJUDICADA,
      'todas',
    ]);
    expect(TIPOS_DA_PROVIDENCIA.map((t) => t.valor)).toEqual([
      TipoDaProvidencia.RETIRADA,
      TipoDaProvidencia.REVISAO,
    ]);
  });
});
