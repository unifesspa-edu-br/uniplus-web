import { describe, expect, it } from 'vitest';

import { fraseParaOSuporte, rotuloDoPassoNaTela } from './referencia-da-tela';

describe('referência da tela ao suporte', () => {
  it('nomeia o passo pela posição e pelo rótulo', () => {
    expect(rotuloDoPassoNaTela('Vagas')).toBe('Passo 4 — Vagas');
  });

  it('diz o passo e o código', () => {
    expect(fraseParaOSuporte('Vagas', ['regra_x versão 1'])).toBe(
      'Informe ao suporte: passo 4 — Vagas, código regra_x versão 1.',
    );
  });

  it('põe todos os códigos no plural', () => {
    expect(fraseParaOSuporte('Formulários', ['a', 'b'])).toBe(
      'Informe ao suporte: passo 12 — Formulários, códigos a, b.',
    );
  });
});
