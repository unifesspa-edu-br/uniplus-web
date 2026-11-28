import { describe, expect, it } from 'vitest';
import { varianteDaSituacaoDaInscricao } from './situacao-da-inscricao';

describe('cor da situação da inscrição', () => {
  it.each([
    ['RASCUNHO', 'warning'],
    ['ENVIADA', 'success'],
    ['CANCELADA', 'neutral'],
  ])('%s usa a variante %s', (codigo, variante) => {
    expect(varianteDaSituacaoDaInscricao(codigo)).toBe(variante);
  });

  it.each(['DESCONHECIDA', 'constructor', 'toString'])(
    'o código desconhecido %s usa a variante neutra',
    (codigo) => {
      expect(varianteDaSituacaoDaInscricao(codigo)).toBe('neutral');
    },
  );
});
