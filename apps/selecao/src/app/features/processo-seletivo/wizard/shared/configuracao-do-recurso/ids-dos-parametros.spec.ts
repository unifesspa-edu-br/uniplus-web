import { describe, expect, it } from 'vitest';

import { alvosDoControleDosParametros, idsDosParametros } from './ids-dos-parametros';
import type { CampoDosParametros } from './parametros-do-recurso';

const PREFIXO = 'recurso-x';

describe('idsDosParametros', () => {
  it('deriva todos os ids do prefixo da tela, para a fase e a etapa não colidirem', () => {
    const ids = idsDosParametros(PREFIXO);

    expect(ids.prazoDeInterposicao.valor).toBe('recurso-x-prazo-interposicao-valor');
    expect(ids.prazoDaSegundaInstancia.unidade).toBe('recurso-x-prazo-segunda-unidade');
    expect(ids.instanciaSuperior.sim).toBe('recurso-x-superior-sim');
    expect(ids.efeito).toBe('recurso-x-efeito');
    expect(ids.guarda).toBe('recurso-x-guarda');
    expect(ids.aviso).toBe('recurso-x-aviso');
  });

  it('não repete id entre as partes', () => {
    const { prazoDeInterposicao, prazoDaSegundaInstancia, instanciaSuperior, ...resto } =
      idsDosParametros(PREFIXO);
    const todos = [
      ...Object.values(prazoDeInterposicao),
      ...Object.values(prazoDaSegundaInstancia),
      ...Object.values(instanciaSuperior),
      ...Object.values(resto),
    ];

    expect(new Set(todos).size).toBe(todos.length);
  });
});

describe('alvosDoControleDosParametros', () => {
  it.each<[CampoDosParametros, readonly string[]]>([
    ['prazoValor', ['recurso-x-prazo-interposicao-valor']],
    [
      'prazoUnidade',
      ['recurso-x-prazo-interposicao-unidade', 'recurso-x-prazo-interposicao-situacao'],
    ],
    ['efeitoSuspensivo', ['recurso-x-efeito-grupo']],
    ['guardaDaVaga', ['recurso-x-guarda-grupo']],
    ['prazoSegundaInstanciaValor', ['recurso-x-prazo-segunda-valor']],
    [
      'prazoSegundaInstanciaUnidade',
      ['recurso-x-prazo-segunda-unidade', 'recurso-x-prazo-segunda-situacao'],
    ],
  ])('leva %s aos controles dele, do preferido ao de reserva', (controle, esperados) => {
    expect(alvosDoControleDosParametros(PREFIXO, controle, null)).toEqual(esperados);
  });

  it.each([
    [true, 'recurso-x-superior-sim'],
    [false, 'recurso-x-superior-nao'],
    [null, 'recurso-x-superior-sim'],
  ])(
    'leva a instância superior à opção marcada (%s), ou à primeira sem marca',
    (marcada, opcao) => {
      expect(alvosDoControleDosParametros(PREFIXO, 'admiteInstanciaSuperior', marcada)).toEqual([
        opcao,
        'recurso-x-superior-recusas',
      ]);
    },
  );
});
