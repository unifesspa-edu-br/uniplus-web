import { describe, expect, it } from 'vitest';

import { CLIENT_PROBLEM_CODES, type ProblemDetails } from './problem-details';
import { identificadorDoPedido, referenciaDaRecusa } from './referencia-ao-suporte';

const CODIGO = 'uniplus.selecao.exemplo';
const IDENTIFICADOR = '0af7651916cd43dd8448eb211c80319c';

function problema(code: string, traceId: string): ProblemDetails {
  return { type: 'about:blank', title: 'Recusa', status: 422, code, traceId };
}

describe('referenciaDaRecusa', () => {
  it('traz o código e o identificador quando a resposta os envia no formato da API', () => {
    expect(referenciaDaRecusa(problema(CODIGO, IDENTIFICADOR))).toEqual({
      origem: 'servidor',
      codigoDoErro: CODIGO,
      identificadorDoPedido: IDENTIFICADOR,
    });
  });

  it('aceita código com sublinhado e vários níveis', () => {
    const referencia = referenciaDaRecusa(problema('uniplus.selecao.fase_invalida.x', ''));

    expect(referencia).toMatchObject({ codigoDoErro: 'uniplus.selecao.fase_invalida.x' });
  });

  it.each([
    ['vazio', ''],
    ['sem ponto', 'semponto'],
    ['com maiúscula', 'Uniplus.Selecao.exemplo'],
    ['com espaço', 'uniplus.selecao exemplo'],
    ['sintético do cliente com dígito', 'uniplus.client2.erro'],
  ])('descarta o código %s e mantém o identificador', (_descricao, codigo) => {
    expect(referenciaDaRecusa(problema(codigo, IDENTIFICADOR))).toEqual({
      origem: 'servidor',
      codigoDoErro: null,
      identificadorDoPedido: IDENTIFICADOR,
    });
  });

  it.each([
    ['vazio', ''],
    ['curto', '0af76519'],
    ['longo', `${IDENTIFICADOR}0`],
    ['fora do hexadecimal', 'z'.repeat(32)],
  ])('descarta o identificador %s e mantém o código', (_descricao, traceId) => {
    expect(referenciaDaRecusa(problema(CODIGO, traceId))).toEqual({
      origem: 'servidor',
      codigoDoErro: CODIGO,
      identificadorDoPedido: null,
    });
  });

  it.each(Object.values(CLIENT_PROBLEM_CODES))(
    'não leva ao suporte o código sintético do cliente %s',
    (codigo) => {
      expect(referenciaDaRecusa(problema(codigo, ''))).toBeNull();
    },
  );

  it('devolve nulo, nunca campo vazio, quando nenhum dos dois serve', () => {
    expect(referenciaDaRecusa(problema('', ''))).toBeNull();
    expect(referenciaDaRecusa(problema('invalido', 'curto'))).toBeNull();
  });
});

describe('identificadorDoPedido', () => {
  it('devolve o identificador de 32 hexadecimais e nulo para o resto', () => {
    expect(identificadorDoPedido(problema(CODIGO, IDENTIFICADOR))).toBe(IDENTIFICADOR);
    expect(identificadorDoPedido(problema(CODIGO, ''))).toBeNull();
  });
});
