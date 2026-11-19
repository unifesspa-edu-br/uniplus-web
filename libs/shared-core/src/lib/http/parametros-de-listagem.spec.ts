import { HttpParams } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { comBusca, comOrdenacaoDaPrimeiraPagina, janelaDaPagina } from './parametros-de-listagem';

describe('janelaDaPagina', () => {
  it('com cursor, segue a página pedida e não envia limit', () => {
    const params = janelaDaPagina(new HttpParams(), {
      cursor: 'abc',
      direction: 'prev',
      limit: 10,
    });

    expect(params.get('cursor')).toBe('abc');
    expect(params.get('direction')).toBe('prev');
    expect(params.has('limit')).toBe(false);
  });

  it('com cursor e sem direção, avança', () => {
    const params = janelaDaPagina(new HttpParams(), { cursor: 'abc' });

    expect(params.get('direction')).toBe('next');
  });

  it('cursor vazio conta como ausente e abre a primeira página', () => {
    const params = janelaDaPagina(new HttpParams(), { cursor: '', limit: 5 });

    expect(params.has('cursor')).toBe(false);
    expect(params.has('direction')).toBe(false);
    expect(params.get('limit')).toBe('5');
  });

  it('sem cursor nem limit, abre a primeira página com o limite padrão de 100', () => {
    expect(janelaDaPagina(new HttpParams(), {}).get('limit')).toBe('100');
  });

  it('aceita outro limite padrão, que o limit pedido ainda supera', () => {
    expect(janelaDaPagina(new HttpParams(), {}, 50).get('limit')).toBe('50');
    expect(janelaDaPagina(new HttpParams(), { limit: 20 }, 50).get('limit')).toBe('20');
  });

  it('preserva os parâmetros que já estavam e a ordem em que entraram', () => {
    const params = janelaDaPagina(new HttpParams().set('q', 'ab'), { cursor: 'c' });

    expect(params.keys()).toEqual(['q', 'cursor', 'direction']);
  });
});

describe('comBusca', () => {
  it('envia o texto sem as pontas em branco', () => {
    expect(comBusca(new HttpParams(), '  engenharia ').get('q')).toBe('engenharia');
  });

  it.each([undefined, '', '   '])('não envia q quando o texto é %j', (texto) => {
    expect(comBusca(new HttpParams(), texto).has('q')).toBe(false);
  });
});

describe('comOrdenacaoDaPrimeiraPagina', () => {
  it('envia o sort, sem as pontas em branco, quando a janela não tem cursor', () => {
    const params = comOrdenacaoDaPrimeiraPagina(
      new HttpParams().set('limit', '100'),
      ' nome,-grau ',
    );

    expect(params.get('sort')).toBe('nome,-grau');
  });

  it('não reenvia o sort quando a janela segue um cursor', () => {
    const params = comOrdenacaoDaPrimeiraPagina(new HttpParams().set('cursor', 'abc'), 'nome');

    expect(params.has('sort')).toBe(false);
  });

  it.each([undefined, '', '  '])('não envia sort quando a ordenação é %j', (ordenacao) => {
    expect(comOrdenacaoDaPrimeiraPagina(new HttpParams(), ordenacao).has('sort')).toBe(false);
  });
});
