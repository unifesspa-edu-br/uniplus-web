import { describe, expect, it } from 'vitest';
import type { AprovacaoDaProtecaoDto, AtoDaProtecaoDto } from '@uniplus/shared-data/configuracao';
import { justificativaDaSituacao } from './justificativa-da-situacao';

const APROVADA: AprovacaoDaProtecaoDto = {
  situacao: 'APROVADA',
  ciclo: 2,
  solicitadaEm: null,
  decididaEm: null,
  classificacaoRecomendada: null,
  justificativa: null,
  aceitaEm: null,
  manifestadaEm: null,
  manifestacaoDesfavoravel: false,
  manifestacoesNoCiclo: 0,
};

const aprovacao = (ciclo: number, justificativa: string | null): AtoDaProtecaoDto => ({
  ato: 'APROVACAO',
  instante: '2026-11-10T12:00:00Z',
  atorNome: 'Betina Neves',
  classificacaoProtecao: 'PESSOAL',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Conferir o laudo.',
  classificacaoRecomendada: null,
  justificativa,
  ciclo,
  dianteDeManifestacaoDesfavoravel: justificativa !== null,
});

describe('justificativa da situação do item', () => {
  it('na aprovação, lê o ato de aprovação mais recente do ciclo atual', () => {
    const atos = [aprovacao(1, 'Do ciclo anterior.'), aprovacao(2, 'A pessoal basta.')];

    expect(justificativaDaSituacao(APROVADA, atos)).toBe('A pessoal basta.');
  });

  it('na aprovação sem ato do ciclo, não há justificativa', () => {
    expect(justificativaDaSituacao(APROVADA, [aprovacao(1, 'Do ciclo anterior.')])).toBeNull();
  });

  it('no ajuste e na reprovação, vale a justificativa da própria aprovação', () => {
    const reprovada = { ...APROVADA, situacao: 'REPROVADA', justificativa: 'Falta a base.' };

    expect(justificativaDaSituacao(reprovada, [aprovacao(2, 'Ignorada.')])).toBe('Falta a base.');
  });
});
