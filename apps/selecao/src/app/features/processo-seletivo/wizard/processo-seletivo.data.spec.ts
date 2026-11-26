import { describe, expect, it } from 'vitest';

import { TEXTO_DA_PENDENCIA_DA_RESOLUCAO } from './passos/classificacao/classificacao-para-comando';
import { NOME_DO_PASSO_DA_FORMULA, PASSOS, ROTULOS_DOS_PASSOS } from './processo-seletivo.data';

describe('nome do passo da fórmula', () => {
  it('é o nome que o menu mostra para o passo', () => {
    const passo = PASSOS.find((candidato) => candidato.titulo === NOME_DO_PASSO_DA_FORMULA);

    expect(NOME_DO_PASSO_DA_FORMULA).toBe('Fórmula e precisão');
    expect(ROTULOS_DOS_PASSOS).toContain('Fórmula e precisão');
    expect(passo?.rotulo).toBe('Fórmula e precisão');
  });

  it('é o nome que a recusa da resolução de Peso por Área usa para apontar o passo', () => {
    expect(TEXTO_DA_PENDENCIA_DA_RESOLUCAO.obrigatoria.resumo).toBe(
      'Selecione a resolução de Peso por Área usada na nota, no passo Fórmula e precisão.',
    );
  });
});
