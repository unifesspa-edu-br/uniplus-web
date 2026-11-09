import { describe, expect, it } from 'vitest';
import { destinoDaProposta, diferencaDaVersao, mudancaDaPermissao } from './diferenca-da-versao';

describe('diferencaDaVersao', () => {
  it('separa o que a proposta acrescenta do que retira, em ordem alfabética', () => {
    const diferenca = diferencaDaVersao(['b:x:y', 'a:x:y', 'c:x:y'], new Set(['c:x:y', 'z:x:y', 'd:x:y']));

    expect(diferenca.acrescimo).toEqual(['d:x:y', 'z:x:y']);
    expect(diferenca.remocao).toEqual(['a:x:y', 'b:x:y']);
  });

  it('não acha diferença quando a proposta repete o que está em vigor', () => {
    expect(diferencaDaVersao(['a:x:y'], new Set(['a:x:y']))).toEqual({ acrescimo: [], remocao: [] });
  });

  it('marca cada permissão como acrescentada, removida ou sem mudança', () => {
    const diferenca = { acrescimo: ['n:x:y'], remocao: ['o:x:y'] };

    expect(mudancaDaPermissao('n:x:y', diferenca)).toBe('acrescentada');
    expect(mudancaDaPermissao('o:x:y', diferenca)).toBe('removida');
    expect(mudancaDaPermissao('i:x:y', diferenca)).toBeNull();
  });
});

describe('destinoDaProposta', () => {
  it.each([
    ['acréscimo vai para versão', { acrescimo: ['a'], remocao: [] }, false, 'versao'],
    ['acréscimo com remoção vai para versão', { acrescimo: ['a'], remocao: ['b'] }, false, 'versao'],
    ['texto novo vai para versão', { acrescimo: [], remocao: [] }, true, 'versao'],
    ['só remoção vale na hora', { acrescimo: [], remocao: ['b'] }, false, 'remocao'],
    ['sem mudança não envia', { acrescimo: [], remocao: [] }, false, 'nada'],
  ] as const)('%s', (_, diferenca, textoMudou, esperado) => {
    expect(destinoDaProposta(diferenca, textoMudou)).toBe(esperado);
  });
});
