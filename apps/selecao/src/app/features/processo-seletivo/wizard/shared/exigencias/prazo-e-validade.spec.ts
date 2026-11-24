import {
  EscolhaDoPrazoDeEmissaoCodigo,
  EscolhaDaValidadeCodigo,
  UnidadeDoPrazoDeEmissaoCodigo,
  TipoDaDataDeReferenciaCodigo,
  EfeitoNaAnaliseDoDocumentoCodigo,
  type DocumentoExigidoDto,
} from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';
import {
  comando,
  detalheDaApi,
  exigencia,
  exigenciaDaApi,
  FASES,
  ID_ISENCAO,
  rascunho,
} from './exigencias.testing';
import { exigenciasDe } from './leitura-das-exigencias';
import { lerPrazoEValidade, prazoEValidadeParaEnvio } from './prazo-e-validade';

const opcao = <T extends string>(codigo: T) => ({ codigo, rotulo: `Rótulo de ${codigo}` });
const codigos = new Map([[ID_ISENCAO, 'ISENCAO']]);
const referencia = {
  tipo: opcao(TipoDaDataDeReferenciaCodigo.INICIO_DA_FASE),
  data: null,
  faseId: ID_ISENCAO,
};
const prazo = {
  escolha: opcao(EscolhaDoPrazoDeEmissaoCodigo.COM_PRAZO),
  valor: 3,
  unidade: opcao(UnidadeDoPrazoDeEmissaoCodigo.DIAS),
  referencia,
  efeitoForaDoPrazo: opcao(EfeitoNaAnaliseDoDocumentoCodigo.RECUSAR_DOCUMENTO),
};
const validade = {
  escolha: opcao(EscolhaDaValidadeCodigo.EXIGE_DOCUMENTO_VALIDO),
  referencia,
  efeitoDoVencimento: opcao(EfeitoNaAnaliseDoDocumentoCodigo.ACEITAR_COM_AVISO),
};

const semExigencias = {
  prazoDeEmissao: {
    escolha: opcao(EscolhaDoPrazoDeEmissaoCodigo.SEM_PRAZO),
    valor: null,
    unidade: null,
    referencia: null,
    efeitoForaDoPrazo: null,
  },
  validade: {
    escolha: opcao(EscolhaDaValidadeCodigo.NAO_EXIGE_DOCUMENTO_VALIDO),
    referencia: null,
    efeitoDoVencimento: null,
  },
};

function enviar(requisitos: Partial<DocumentoExigidoDto['requisitos']>) {
  const criterios = {
    ...exigencia(),
    ...lerPrazoEValidade({ prazoDeEmissao: null, validade: null, ...requisitos }, codigos),
  };
  return prazoEValidadeParaEnvio(criterios, FASES);
}

describe('prazo de emissão e validade do documento', () => {
  it.each([
    UnidadeDoPrazoDeEmissaoCodigo.DIAS,
    UnidadeDoPrazoDeEmissaoCodigo.MESES,
    UnidadeDoPrazoDeEmissaoCodigo.ANOS,
  ])('conserva a unidade %s', (unidade) => {
    const resultado = enviar({ prazoDeEmissao: { ...prazo, unidade: opcao(unidade) } });
    expect(resultado.prazoDeEmissao).toEqual({
      escolha: EscolhaDoPrazoDeEmissaoCodigo.COM_PRAZO,
      valor: 3,
      unidade,
      referencia: {
        tipo: TipoDaDataDeReferenciaCodigo.INICIO_DA_FASE,
        data: null,
        faseId: ID_ISENCAO,
      },
      efeitoForaDoPrazo: EfeitoNaAnaliseDoDocumentoCodigo.RECUSAR_DOCUMENTO,
    });
  });

  it.each(
    [
      UnidadeDoPrazoDeEmissaoCodigo.DIAS,
      UnidadeDoPrazoDeEmissaoCodigo.MESES,
      UnidadeDoPrazoDeEmissaoCodigo.ANOS,
    ].flatMap((unidade) =>
      [
        TipoDaDataDeReferenciaCodigo.FIM_DAS_INSCRICOES,
        TipoDaDataDeReferenciaCodigo.INICIO_DA_FASE,
        TipoDaDataDeReferenciaCodigo.FIM_DA_FASE,
        TipoDaDataDeReferenciaCodigo.DATA_ESPECIFICA,
        TipoDaDataDeReferenciaCodigo.DATA_DA_APRESENTACAO,
      ].map((tipo) => ({ unidade, tipo })),
    ),
  )('conserva $unidade com referência $tipo no prazo e na validade', ({ unidade, tipo }) => {
    const data = tipo === TipoDaDataDeReferenciaCodigo.DATA_ESPECIFICA ? '2027-01-30' : null;
    const faseId =
      tipo === TipoDaDataDeReferenciaCodigo.INICIO_DA_FASE ||
      tipo === TipoDaDataDeReferenciaCodigo.FIM_DA_FASE
        ? ID_ISENCAO
        : null;
    const recebida = { tipo: opcao(tipo), data, faseId };
    const resultado = enviar({
      prazoDeEmissao: { ...prazo, unidade: opcao(unidade), referencia: recebida },
      validade: { ...validade, referencia: recebida },
    });
    const enviada = { tipo, data, faseId };
    expect(resultado.prazoDeEmissao?.referencia).toEqual(enviada);
    expect(resultado.prazoDeEmissao?.unidade).toBe(unidade);
    expect(resultado.validade?.referencia).toEqual(enviada);
  });

  it('conserva as escolhas sem prazo e sem exigência de validade', () => {
    const resultado = enviar(semExigencias);
    expect(resultado.prazoDeEmissao).toEqual({
      escolha: EscolhaDoPrazoDeEmissaoCodigo.SEM_PRAZO,
      valor: null,
      unidade: null,
      referencia: null,
      efeitoForaDoPrazo: null,
    });
    expect(resultado.validade).toEqual({
      escolha: EscolhaDaValidadeCodigo.NAO_EXIGE_DOCUMENTO_VALIDO,
      referencia: null,
      efeitoDoVencimento: null,
    });
  });

  it('envia escolhas ainda não declaradas como nulas', () => {
    expect(prazoEValidadeParaEnvio(exigencia(), FASES)).toEqual({
      prazoDeEmissao: null,
      validade: null,
    });
    expect(lerPrazoEValidade({ prazoDeEmissao: null, validade: null }, codigos)).toEqual({
      prazoDeEmissao: null,
      validade: null,
    });
    const requisitos = comando(rascunho(exigencia()))[0].documento?.requisitos;
    expect(requisitos?.prazoDeEmissao).toBeNull();
    expect(requisitos?.validade).toBeNull();
  });

  it('conserva as escolhas e as fases ausentes ao reler e gravar', () => {
    const faseId = 'fase-ausente';
    const referenciaAusente = {
      ...referencia,
      tipo: opcao(TipoDaDataDeReferenciaCodigo.INICIO_DA_FASE),
      faseId,
    };
    const recebidos = {
      prazoDeEmissao: {
        ...prazo,
        escolha: opcao(EscolhaDoPrazoDeEmissaoCodigo.COM_PRAZO),
        unidade: opcao(UnidadeDoPrazoDeEmissaoCodigo.DIAS),
        efeitoForaDoPrazo: opcao(EfeitoNaAnaliseDoDocumentoCodigo.RECUSAR_DOCUMENTO),
        referencia: referenciaAusente,
      },
      validade: {
        ...validade,
        escolha: opcao(EscolhaDaValidadeCodigo.EXIGE_DOCUMENTO_VALIDO),
        efeitoDoVencimento: opcao(EfeitoNaAnaliseDoDocumentoCodigo.ACEITAR_COM_AVISO),
        referencia: referenciaAusente,
      },
    };
    const regra = exigenciaDaApi({ requisitos: recebidos });
    const resultado = comando(exigenciasDe(detalheDaApi([regra])))[0].documento?.requisitos;
    expect(resultado).toMatchObject({
      prazoDeEmissao: { escolha: EscolhaDoPrazoDeEmissaoCodigo.COM_PRAZO, referencia: { faseId } },
      validade: { escolha: EscolhaDaValidadeCodigo.EXIGE_DOCUMENTO_VALIDO, referencia: { faseId } },
    });
  });
});
