import { describe, expect, it } from 'vitest';
import {
  ehSituacaoConhecida,
  rotuloDaSituacaoDaInscricao,
  varianteDaSituacaoDaInscricao,
} from './situacao-da-inscricao';

describe('situação da inscrição', () => {
  it.each([
    ['RASCUNHO', 'Rascunho', 'warning'],
    ['ENVIADA', 'Enviada', 'success'],
    ['CANCELADA', 'Cancelada', 'neutral'],
  ])('reconhece %s com rótulo e variante', (codigo, rotulo, variante) => {
    expect(ehSituacaoConhecida(codigo)).toBe(true);
    expect(rotuloDaSituacaoDaInscricao(codigo)).toBe(rotulo);
    expect(varianteDaSituacaoDaInscricao(codigo)).toBe(variante);
  });

  it.each(['DESCONHECIDA', 'constructor', 'toString'])(
    'preserva o código desconhecido %s com variante neutra',
    (codigo) => {
      expect(ehSituacaoConhecida(codigo)).toBe(false);
      expect(rotuloDaSituacaoDaInscricao(codigo)).toBe(codigo);
      expect(varianteDaSituacaoDaInscricao(codigo)).toBe('neutral');
    },
  );
});
