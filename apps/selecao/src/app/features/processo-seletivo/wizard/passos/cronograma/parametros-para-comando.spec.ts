import {
  EfeitoSuspensivoCodigo,
  GuardaDaVagaCodigo,
  UnidadePrazoCodigo as U,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  PARAMETROS_EM_BRANCO,
  type ParametrosDoRecurso,
} from '../../shared/configuracao-do-recurso/parametros-do-recurso';
import { parametrosParaComando } from './cronograma-para-comando';

const comParametros = (parcial: Partial<ParametrosDoRecurso>) =>
  parametrosParaComando({ ...PARAMETROS_EM_BRANCO, ...parcial });

interface CasoDePrazo {
  readonly nome: string;
  readonly valor: string;
  readonly unidade: ParametrosDoRecurso['prazoUnidade'];
  readonly enviado: { readonly valor: number | null; readonly unidade: string | null };
}

describe('parametrosParaComando: prazo de interposição', () => {
  const casos: readonly CasoDePrazo[] = [
    { nome: 'vazio', valor: '', unidade: '', enviado: { valor: null, unidade: null } },
    { nome: 'zero', valor: '0', unidade: U.HORAS, enviado: { valor: 0, unidade: U.HORAS } },
    {
      nome: 'negativo, que não é número',
      valor: '-1',
      unidade: U.HORAS,
      enviado: { valor: null, unidade: U.HORAS },
    },
    {
      nome: 'texto que não é número',
      valor: 'dois',
      unidade: U.HORAS,
      enviado: { valor: null, unidade: U.HORAS },
    },
    { nome: 'sem unidade', valor: '3', unidade: '', enviado: { valor: 3, unidade: null } },
    {
      nome: 'fração em dias úteis',
      valor: '1,5',
      unidade: U.DIAS_UTEIS,
      enviado: { valor: 1.5, unidade: U.DIAS_UTEIS },
    },
    {
      nome: 'em dias corridos lido',
      valor: '2',
      unidade: U.DIAS,
      enviado: { valor: 2, unidade: U.DIAS },
    },
    {
      nome: 'válido',
      valor: '2',
      unidade: U.DIAS_UTEIS,
      enviado: { valor: 2, unidade: U.DIAS_UTEIS },
    },
  ];

  it.each(casos)(
    '$nome: envia o valor e a unidade como estão, e a API recusa o que não vale',
    ({ valor, unidade, enviado }) => {
      expect(comParametros({ prazoValor: valor, prazoUnidade: unidade })).toMatchObject({
        prazoValor: enviado.valor,
        prazoUnidade: enviado.unidade,
      });
    },
  );

  it('não troca o prazo em branco por zero', () => {
    expect(comParametros({}).prazoValor).toBeNull();
  });

  it('envia com mais de quatro casas decimais como está, para a API dar o código do validador', () => {
    expect(comParametros({ prazoValor: '1,23456' }).prazoValor).toBe(1.23456);
  });
});

interface CasoDeSegundaInstancia {
  readonly nome: string;
  readonly admite: boolean;
  readonly valor: string;
  readonly unidade: ParametrosDoRecurso['prazoSegundaInstanciaUnidade'];
  readonly enviado: { readonly valor: number | null; readonly unidade: string | null };
}

describe('parametrosParaComando: instância superior e prazo da 2ª instância', () => {
  const caso = (
    nome: string,
    admite: boolean,
    prazo: readonly [string, ParametrosDoRecurso['prazoSegundaInstanciaUnidade']],
    enviado: CasoDeSegundaInstancia['enviado'],
  ): CasoDeSegundaInstancia => ({ nome, admite, valor: prazo[0], unidade: prazo[1], enviado });

  const casos: readonly CasoDeSegundaInstancia[] = [
    caso('Não, sem prazo', false, ['', ''], { valor: null, unidade: null }),
    caso('Sim, sem prazo', true, ['', ''], { valor: null, unidade: null }),
    caso('Sim, só a unidade', true, ['', U.HORAS], { valor: null, unidade: U.HORAS }),
    caso('Sim, só o valor', true, ['3', ''], { valor: 3, unidade: null }),
    caso('Sim, valor zero', true, ['0', U.DIAS_UTEIS], { valor: 0, unidade: U.DIAS_UTEIS }),
    caso('Sim, par completo', true, ['3', U.DIAS_UTEIS], { valor: 3, unidade: U.DIAS_UTEIS }),
    caso('Não, par completo lido', false, ['3', U.DIAS_UTEIS], { valor: 3, unidade: U.DIAS_UTEIS }),
    caso('Não, só o valor lido', false, ['3', ''], { valor: 3, unidade: null }),
    caso('Não, só a unidade lida', false, ['', U.HORAS], { valor: null, unidade: U.HORAS }),
  ];

  it.each(casos)(
    '$nome: os dois campos vão sempre, com nulo no vazio',
    ({ admite, valor, unidade, enviado }) => {
      expect(
        comParametros({
          admiteInstanciaSuperior: admite,
          prazoSegundaInstanciaValor: valor,
          prazoSegundaInstanciaUnidade: unidade,
        }),
      ).toMatchObject({
        admiteInstanciaSuperior: admite,
        prazoSegundaInstanciaValor: enviado.valor,
        prazoSegundaInstanciaUnidade: enviado.unidade,
      });
    },
  );
});

describe('parametrosParaComando: efeito suspensivo e guarda da vaga', () => {
  it('efeito vazio vai nulo', () => {
    expect(comParametros({ efeitoSuspensivo: '' }).efeitoSuspensivo).toBeNull();
  });

  it('efeito e guarda do vocabulário vão pelo código', () => {
    expect(
      comParametros({
        efeitoSuspensivo: EfeitoSuspensivoCodigo.SEM_EFEITO_SUSPENSIVO,
        guardaDaVaga: GuardaDaVagaCodigo.ATE_O_RESULTADO_DEFINITIVO,
      }),
    ).toMatchObject({
      efeitoSuspensivo: 'SEM_EFEITO_SUSPENSIVO',
      guardaDaVaga: 'ATE_O_RESULTADO_DEFINITIVO',
    });
  });

  it('guarda vazia vai nula, e a API grava o padrão', () => {
    expect(comParametros({ guardaDaVaga: '' }).guardaDaVaga).toBeNull();
  });

  it('"não guarda" lida com instância superior vai como está, e a API recusa', () => {
    expect(
      comParametros({ admiteInstanciaSuperior: true, guardaDaVaga: GuardaDaVagaCodigo.NAO_GUARDA }),
    ).toMatchObject({ admiteInstanciaSuperior: true, guardaDaVaga: 'NAO_GUARDA' });
  });

  it('a unidade do prazo vai pelo código do vocabulário', () => {
    expect(comParametros({ prazoUnidade: U.HORAS }).prazoUnidade).toBe('HORAS');
  });
});
