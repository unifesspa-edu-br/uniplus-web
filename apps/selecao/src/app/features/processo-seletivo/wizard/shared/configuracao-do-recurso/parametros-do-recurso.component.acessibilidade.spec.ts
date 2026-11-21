import axe from 'axe-core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LEITURA_EM_BRANCO } from './parametros-do-recurso';
import {
  montarParametrosDoRecurso,
  PARAMETROS_COM_INSTANCIA_SUPERIOR,
  PARAMETROS_SEM_INSTANCIA_SUPERIOR,
  umaLeituraDoRecurso,
} from './parametros-do-recurso.testing';
import { umaRecusa } from './prazo-do-recurso.testing';

const violacoes = async (raiz: HTMLElement) =>
  (await axe.run(raiz, { rules: { region: { enabled: false } } })).violations;

describe('ParametrosDoRecursoComponent: acessibilidade', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it.each([
    ['sem instância superior', { parametros: PARAMETROS_SEM_INSTANCIA_SUPERIOR }],
    [
      'com instância superior e prazo da 2ª instância',
      { parametros: PARAMETROS_COM_INSTANCIA_SUPERIOR },
    ],
    [
      'com a instância superior em aberto',
      { parametros: { ...PARAMETROS_SEM_INSTANCIA_SUPERIOR, admiteInstanciaSuperior: null } },
    ],
    [
      'com o prazo da 2ª instância lido sem instância superior',
      {
        parametros: { ...PARAMETROS_COM_INSTANCIA_SUPERIOR, admiteInstanciaSuperior: false },
        leitura: umaLeituraDoRecurso({ prazoDaSegundaInstanciaSemInstanciaSuperior: true }),
      },
    ],
    [
      'com valor fora do vocabulário',
      {
        parametros: { ...PARAMETROS_SEM_INSTANCIA_SUPERIOR, efeitoSuspensivo: 'antigo' },
        leitura: umaLeituraDoRecurso({ rotulos: { efeitoSuspensivo: 'Efeito antigo' } }),
      },
    ],
    [
      'com recusas ativas e a conferir',
      {
        parametros: PARAMETROS_COM_INSTANCIA_SUPERIOR,
        leitura: LEITURA_EM_BRANCO,
        recusas: [
          umaRecusa('prazoValor'),
          umaRecusa('efeitoSuspensivo'),
          umaRecusa('guardaDaVaga', true),
          umaRecusa('admiteInstanciaSuperior'),
          umaRecusa('prazoSegundaInstanciaUnidade'),
        ],
      },
    ],
    ['desabilitado', { desabilitado: true }],
  ])('não tem violações %s', async (_nome, entradas) => {
    const { raiz } = montarParametrosDoRecurso(entradas);
    document.body.append(raiz);

    expect(await violacoes(raiz)).toEqual([]);
    raiz.remove();
  });

  it.each(['pendentes', 'falham', 'vazias'] as const)(
    'não tem violações com as opções %s',
    async (opcoes) => {
      const { raiz } = montarParametrosDoRecurso({}, opcoes);
      document.body.append(raiz);

      expect(await violacoes(raiz)).toEqual([]);
      raiz.remove();
    },
  );
});
