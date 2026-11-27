import { ConsequenciaDoDescumprimentoCodigo } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import {
  consequenciaCabe,
  ehDaInscricao,
  ehDaIsencao,
  faseTemLugar,
  naFase,
  obrigatoriedadeNaFase,
  type FaseQueRespondeFormulario,
} from './obrigatoriedade-na-fase';
import { formularioDoRascunho } from './formulario-de-inscricao.testing';
import { conteudoInicial } from '@uniplus/shared-inscricao/formulario';

const fase = (
  codigo: string,
  extra: Partial<FaseQueRespondeFormulario> = {},
): FaseQueRespondeFormulario => ({
  codigo,
  coletaInscricao: false,
  coletaSolicitacaoIsencao: false,
  ...extra,
});
const INSCRICAO = fase('INSCRICAO', { coletaInscricao: true });
const ISENCAO = fase('ISENCAO', { coletaSolicitacaoIsencao: true });
const DIVIDIDA = fase('DIVIDIDA', { coletaInscricao: true, coletaSolicitacaoIsencao: true });
const AVALIACAO = fase('AVALIACAO');
const OBRIGATORIO = { obrigatorio: true };
const FACULTATIVO = { obrigatorio: false };

describe('a obrigatoriedade que a fase impõe', () => {
  it('a fase que coleta inscrição tem o formulário obrigatório, sem escolha', () => {
    expect(obrigatoriedadeNaFase(INSCRICAO, { atual: false, ocupantes: [] })).toMatchObject({
      obrigatorio: true,
      fixa: true,
      podeAlternar: false,
    });
  });

  it('a fase que só coleta o pedido de isenção tem o formulário facultativo, sem escolha', () => {
    expect(obrigatoriedadeNaFase(ISENCAO, { atual: true, ocupantes: [] })).toMatchObject({
      obrigatorio: false,
      fixa: true,
    });
  });

  it('a fase que coleta as duas divide: o obrigatório primeiro, o facultativo no que sobra', () => {
    expect(obrigatoriedadeNaFase(DIVIDIDA, { atual: true, ocupantes: [] }).obrigatorio).toBe(true);
    expect(
      obrigatoriedadeNaFase(DIVIDIDA, { atual: true, ocupantes: [OBRIGATORIO] }).obrigatorio,
    ).toBe(false);
  });

  it('nas demais fases o operador escolhe e pode alternar quando o outro lugar está livre', () => {
    expect(obrigatoriedadeNaFase(AVALIACAO, { atual: true, ocupantes: [] })).toEqual({
      obrigatorio: true,
      fixa: false,
      podeAlternar: true,
      explicacao: null,
    });
    expect(
      obrigatoriedadeNaFase(AVALIACAO, { atual: true, ocupantes: [FACULTATIVO] }).podeAlternar,
    ).toBe(false);
  });

  it('a escolha que repetiria a de outro formulário da fase passa para a que sobra', () => {
    expect(
      obrigatoriedadeNaFase(AVALIACAO, { atual: true, ocupantes: [OBRIGATORIO] }).obrigatorio,
    ).toBe(false);
  });

  it('sem fase escolhida o operador escolhe', () => {
    expect(obrigatoriedadeNaFase(undefined, { atual: true, ocupantes: [] }).fixa).toBe(false);
  });
});

describe('a consequência da falta de envio', () => {
  it('só cabe no obrigatório de fase que não coleta inscrição', () => {
    expect(consequenciaCabe(AVALIACAO, true)).toBe(true);
    expect(consequenciaCabe(AVALIACAO, false)).toBe(false);
    expect(consequenciaCabe(INSCRICAO, true)).toBe(false);
    expect(consequenciaCabe(undefined, true)).toBe(true);
  });

  it('é zerada quando o formulário passa a uma fase em que não cabe', () => {
    const formulario = formularioDoRascunho(conteudoInicial(), {
      faseCodigo: 'AVALIACAO',
      consequenciaDaFaltaDeEnvio: ConsequenciaDoDescumprimentoCodigo.ELIMINA_DO_PROCESSO,
    });

    expect(naFase(formulario, AVALIACAO, []).consequenciaDaFaltaDeEnvio).toBe(
      ConsequenciaDoDescumprimentoCodigo.ELIMINA_DO_PROCESSO,
    );
    expect(naFase(formulario, INSCRICAO, []).consequenciaDaFaltaDeEnvio).toBeNull();
    expect(naFase(formulario, ISENCAO, []).obrigatorio).toBe(false);
  });
});

describe('o que o formulário é, pelas marcas da fase', () => {
  it('a inscrição é o obrigatório da fase que coleta inscrição', () => {
    expect(ehDaInscricao(OBRIGATORIO, INSCRICAO)).toBe(true);
    expect(ehDaInscricao(FACULTATIVO, INSCRICAO)).toBe(false);
    expect(ehDaInscricao(OBRIGATORIO, AVALIACAO)).toBe(false);
  });

  it('a isenção é o facultativo da fase que coleta o pedido', () => {
    expect(ehDaIsencao(FACULTATIVO, ISENCAO)).toBe(true);
    expect(ehDaIsencao(OBRIGATORIO, ISENCAO)).toBe(false);
    expect(ehDaIsencao(FACULTATIVO, undefined)).toBe(false);
  });
});

describe('a fase que ainda tem lugar para um formulário', () => {
  it('a fase de inscrição só tem lugar para o obrigatório', () => {
    expect(faseTemLugar(INSCRICAO, [], true)).toBe(true);
    expect(faseTemLugar(INSCRICAO, [OBRIGATORIO], true)).toBe(false);
  });

  it('a fase do pedido de isenção só tem lugar quando o processo cobra taxa', () => {
    expect(faseTemLugar(ISENCAO, [], true)).toBe(true);
    expect(faseTemLugar(ISENCAO, [], false)).toBe(false);
    expect(faseTemLugar(ISENCAO, [FACULTATIVO], true)).toBe(false);
  });

  it('a fase dividida tem lugar enquanto sobrar o obrigatório ou o facultativo com taxa', () => {
    expect(faseTemLugar(DIVIDIDA, [OBRIGATORIO], true)).toBe(true);
    expect(faseTemLugar(DIVIDIDA, [OBRIGATORIO], false)).toBe(false);
    expect(faseTemLugar(DIVIDIDA, [], false)).toBe(true);
  });

  it('as demais fases têm um obrigatório e um facultativo, no máximo', () => {
    expect(faseTemLugar(AVALIACAO, [OBRIGATORIO], false)).toBe(true);
    expect(faseTemLugar(AVALIACAO, [OBRIGATORIO, FACULTATIVO], true)).toBe(false);
  });
});
