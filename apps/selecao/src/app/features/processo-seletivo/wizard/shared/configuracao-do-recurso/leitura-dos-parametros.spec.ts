import { describe, expect, it } from 'vitest';

import { parametrosEmTexto } from './leitura-dos-parametros';
import { PARAMETROS_EM_BRANCO } from './parametros-do-recurso';
import {
  PARAMETROS_COM_INSTANCIA_SUPERIOR,
  PARAMETROS_SEM_INSTANCIA_SUPERIOR,
  umaLeituraDoRecurso,
} from './parametros-do-recurso.testing';

const ROTULOS = {
  prazoUnidade: 'Dias úteis',
  prazoSegundaInstanciaUnidade: 'Horas',
  efeitoSuspensivo: 'Sem efeito suspensivo',
  guardaDaVaga: 'Guarda a vaga até o resultado definitivo',
};

describe('parametrosEmTexto', () => {
  it('mostra o prazo com o nome que a leitura deu à unidade, e não o código', () => {
    const texto = parametrosEmTexto(
      PARAMETROS_SEM_INSTANCIA_SUPERIOR,
      umaLeituraDoRecurso({ rotulos: ROTULOS }),
    );

    expect(texto.prazo).toBe('2 — Dias úteis');
    expect(texto.efeitoSuspensivo).toBe('Sem efeito suspensivo');
    expect(texto.guardaDaVaga).toBe('Guarda a vaga até o resultado definitivo');
    expect(texto.admiteInstanciaSuperior).toBe(false);
  });

  it('sem o nome lido, cai no próprio código gravado', () => {
    const texto = parametrosEmTexto(PARAMETROS_SEM_INSTANCIA_SUPERIOR, umaLeituraDoRecurso());

    expect(texto.prazo).toBe('2 — diasUteis');
    expect(texto.efeitoSuspensivo).toBe('semEfeitoSuspensivo');
  });

  it('mostra o prazo da 2ª instância quando há valor e unidade', () => {
    const texto = parametrosEmTexto(
      { ...PARAMETROS_COM_INSTANCIA_SUPERIOR, prazoSegundaInstanciaValor: '48' },
      umaLeituraDoRecurso({ rotulos: { prazoSegundaInstanciaUnidade: 'Horas' } }),
    );

    expect(texto.prazoDaSegundaInstancia).toBe('48 — Horas');
  });

  it('o que não foi respondido fica sem texto, e não vira zero nem "indefinido"', () => {
    const texto = parametrosEmTexto(PARAMETROS_EM_BRANCO, umaLeituraDoRecurso());

    expect(texto).toEqual({
      prazo: null,
      admiteInstanciaSuperior: null,
      efeitoSuspensivo: null,
      guardaDaVaga: null,
      prazoDaSegundaInstancia: null,
    });
  });

  it('mostra só a unidade quando o valor falta, e só o valor quando a unidade falta', () => {
    const semValor = parametrosEmTexto(
      { ...PARAMETROS_EM_BRANCO, prazoUnidade: PARAMETROS_COM_INSTANCIA_SUPERIOR.prazoUnidade },
      umaLeituraDoRecurso({ rotulos: ROTULOS }),
    );
    const semUnidade = parametrosEmTexto(
      { ...PARAMETROS_EM_BRANCO, prazoValor: '5' },
      umaLeituraDoRecurso(),
    );

    expect(semValor.prazo).toBe('Dias úteis');
    expect(semUnidade.prazo).toBe('5');
  });
});
