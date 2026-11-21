import { describe, expect, it } from 'vitest';

import { emOrdem, haRecusaAtiva, type RecusaOrdenada } from './ordem-das-recusas';

function recusa(parcial: Partial<RecusaOrdenada>): RecusaOrdenada {
  return {
    campo: 'fim',
    codigo: 'uniplus.selecao.codigo_a',
    mensagem: 'Mensagem da API.',
    pagina: null,
    ordem: 0,
    resposta: 1,
    origem: 'gravacao',
    aConferir: false,
    ...parcial,
  };
}

const codigos = (recusas: readonly RecusaOrdenada[]) => recusas.map((r) => r.codigo);

describe('emOrdem', () => {
  it('põe as ativas antes das que estão a conferir', () => {
    const lista = [
      recusa({ codigo: 'a', campo: 'x', aConferir: true, resposta: 5 }),
      recusa({ codigo: 'b', campo: 'y', resposta: 1 }),
    ];

    expect(codigos(emOrdem(lista))).toEqual(['b', 'a']);
  });

  it('põe a resposta mais recente primeiro dentro do mesmo estado', () => {
    const lista = [
      recusa({ codigo: 'a', campo: 'x', resposta: 1 }),
      recusa({ codigo: 'b', campo: 'y', resposta: 3 }),
      recusa({ codigo: 'c', campo: 'z', resposta: 2 }),
    ];

    expect(codigos(emOrdem(lista))).toEqual(['b', 'c', 'a']);
  });

  it('mantém a ordem da API dentro da mesma resposta', () => {
    const lista = [
      recusa({ codigo: 'c', campo: 'z', ordem: 2 }),
      recusa({ codigo: 'a', campo: 'x', ordem: 0 }),
      recusa({ codigo: 'b', campo: 'y', ordem: 1 }),
    ];

    expect(codigos(emOrdem(lista))).toEqual(['a', 'b', 'c']);
  });

  it('mantém a ativa antiga e descarta a mesma recusa a conferir, mais recente', () => {
    const lista = [
      recusa({ aConferir: true, resposta: 4 }),
      recusa({ aConferir: false, resposta: 2 }),
    ];

    expect(emOrdem(lista)).toEqual([recusa({ aConferir: false, resposta: 2 })]);
  });

  it('fica com a mais recente quando as duas estão a conferir', () => {
    const lista = [
      recusa({ aConferir: true, resposta: 2, mensagem: 'antiga' }),
      recusa({ aConferir: true, resposta: 4, mensagem: 'recente' }),
    ];

    expect(emOrdem(lista).map((r) => r.mensagem)).toEqual(['recente']);
  });

  it('fica com a mais recente quando as duas estão ativas', () => {
    const lista = [
      recusa({ resposta: 4, mensagem: 'recente' }),
      recusa({ resposta: 2, mensagem: 'antiga' }),
    ];

    expect(emOrdem(lista).map((r) => r.mensagem)).toEqual(['recente']);
  });

  it('mantém as duas quando o código é o mesmo e o campo é outro', () => {
    const lista = [recusa({ campo: 'fim' }), recusa({ campo: 'inicio' })];

    expect(emOrdem(lista)).toHaveLength(2);
  });

  it('mantém as duas quando o campo é o mesmo e o código é outro', () => {
    const lista = [recusa({ codigo: 'a' }), recusa({ codigo: 'b', ordem: 1 })];

    expect(codigos(emOrdem(lista))).toEqual(['a', 'b']);
  });

  it('não altera a lista recebida', () => {
    const lista = [recusa({ codigo: 'b', ordem: 1 }), recusa({ codigo: 'a', ordem: 0 })];

    emOrdem(lista);

    expect(codigos(lista)).toEqual(['b', 'a']);
  });

  it('trata igual a recusa da gravação e a da publicação', () => {
    const lista = [recusa({ origem: 'publicacao', resposta: 3 }), recusa({ resposta: 1 })];

    expect(emOrdem(lista)).toEqual([recusa({ origem: 'publicacao', resposta: 3 })]);
  });
});

describe('haRecusaAtiva', () => {
  it('vale para a lista com ao menos uma recusa ativa', () => {
    expect(haRecusaAtiva([recusa({ aConferir: true }), recusa({ codigo: 'b' })])).toBe(true);
  });

  it('não vale para a lista só de recusas a conferir, nem para a vazia', () => {
    expect(haRecusaAtiva([recusa({ aConferir: true })])).toBe(false);
    expect(haRecusaAtiva([])).toBe(false);
  });
});
