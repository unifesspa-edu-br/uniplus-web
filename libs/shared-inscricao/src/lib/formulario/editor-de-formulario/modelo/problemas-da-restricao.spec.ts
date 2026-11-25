import { describe, expect, it } from 'vitest';

import { exibidoQuando } from './conteudos-de-exemplo.testing';
import { problemaDaRestricao, problemaDoGrupoDeOpcoes } from './problemas-da-restricao';

describe('problemaDaRestricao', () => {
  it.each([
    [{ tipo: 'FAIXA_NUMERICA', minimo: null, maximo: null }, 'Informe ao menos um limite.'],
    [{ tipo: 'FAIXA_NUMERICA', minimo: 10, maximo: 5 }, 'O mínimo é maior que o máximo.'],
    [{ tipo: 'FAIXA_NUMERICA', minimo: 0.12345, maximo: null }, 'Use no máximo 4 casas decimais.'],
    [
      { tipo: 'FAIXA_NUMERICA', minimo: 0.0000001, maximo: null },
      'Use no máximo 4 casas decimais.',
    ],
    [
      { tipo: 'TAMANHO_TEXTO', minimo: 1.5, maximo: null },
      'Os limites são números inteiros, a partir de zero.',
    ],
    [
      { tipo: 'TAMANHO_TEXTO', minimo: -1, maximo: null },
      'Os limites são números inteiros, a partir de zero.',
    ],
    [{ tipo: 'OPCOES_PERMITIDAS', entradas: [] }, 'Declare ao menos um grupo de opções.'],
    [
      { tipo: 'OPCOES_DAS_RESPOSTAS', fatos: [] },
      'Escolha ao menos um campo de onde vêm as opções.',
    ],
  ])('a restrição %o é recusada antes de ir à API', (restricao, problema) => {
    expect(problemaDaRestricao(restricao)).toBe(problema);
  });

  it('a faixa com um limite só e o tamanho coerente passam', () => {
    expect(problemaDaRestricao({ tipo: 'FAIXA_NUMERICA', minimo: null, maximo: 99.5 })).toBeNull();
    expect(problemaDaRestricao({ tipo: 'TAMANHO_TEXTO', minimo: 0, maximo: 200 })).toBeNull();
  });
});

describe('problemaDoGrupoDeOpcoes', () => {
  it('cada grupo das opções permitidas precisa de ao menos um valor, com ou sem condição', () => {
    expect(problemaDoGrupoDeOpcoes({ quando: exibidoQuando('A'), valores: [] })).toBe(
      'Escolha ao menos um valor permitido.',
    );
  });
});
