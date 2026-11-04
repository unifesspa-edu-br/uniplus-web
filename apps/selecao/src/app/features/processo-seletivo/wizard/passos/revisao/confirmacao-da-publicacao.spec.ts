import { describe, expect, it } from 'vitest';

import { atoCompleto, draftVazio } from './publicacao.testing';
import { confirmacaoDaPublicacao } from './confirmacao-da-publicacao';

describe('confirmacaoDaPublicacao', () => {
  const tipos = [{ codigo: 'PORTARIA', nome: 'Portaria' }];

  it('diz "não informado" quando o ato não tem número, e o tipo com o código', () => {
    const draft = draftVazio();
    draft.publicacao = { ...draft.publicacao, numero: '   ', ato: atoCompleto() };

    const { itens } = confirmacaoDaPublicacao(draft, tipos, new Map());

    expect(itens.find((item) => item.rotulo === 'Número do ato')?.valor).toBe('não informado');
    expect(itens.find((item) => item.rotulo === 'Tipo de ato')?.valor).toBe('Portaria (PORTARIA)');
  });
});
