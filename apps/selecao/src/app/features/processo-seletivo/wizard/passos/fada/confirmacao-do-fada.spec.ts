import { describe, expect, it } from 'vitest';

import type { WizardDraft } from '../../processo-seletivo.models';
import { confirmacaoDoFada } from './confirmacao-do-fada';

const fada = {
  aplica: true,
  regraCodigo: 'BONUS-MULTIPLICATIVO',
  fator: '1,2',
  teto: '',
} as unknown as WizardDraft['fada'];

const entrada = (nomeDaRegra: string | null) => ({
  fada,
  nomeDaRegra,
  identificacaoDaBaseLegal: undefined,
  citaElegibilidade: true,
  fatoDeElegibilidade: 'Tem direito ao acréscimo (TEM_DIREITO)',
});

describe('confirmacaoDoFada', () => {
  it('mostra o nome da regra na linha "Regra" e o dado escolhido com nome e código', () => {
    const { itens } = confirmacaoDoFada(entrada('Multiplicador de teste'));

    expect(itens[0]).toEqual({ rotulo: 'Regra', valor: 'Multiplicador de teste' });
    expect(itens).toContainEqual({
      rotulo: 'Quem recebe o Fator de Atenuação',
      valor: 'Tem direito ao acréscimo (TEM_DIREITO)',
    });
  });

  it('mostra o código da regra quando a lista de regras não a traz', () => {
    expect(confirmacaoDoFada(entrada(null)).itens[0]).toEqual({
      rotulo: 'Regra',
      valor: 'BONUS-MULTIPLICATIVO',
    });
  });

  it('declara o processo sem o fator quando não aplica', () => {
    const sem = { ...entrada(null), fada: { ...fada, aplica: false } };

    expect(confirmacaoDoFada(sem).itens).toEqual([
      { rotulo: 'Fator de Atenuação', valor: 'Não aplicado neste processo' },
    ]);
  });
});
