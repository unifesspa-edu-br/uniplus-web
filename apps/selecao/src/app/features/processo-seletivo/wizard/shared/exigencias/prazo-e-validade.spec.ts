import type { RequisitosDoDocumentoDtoProvisorio } from '@uniplus/shared-data/selecao';
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

const opcao = (codigo: string) => ({ codigo, rotulo: `Rótulo de ${codigo}` });
const codigos = new Map([[ID_ISENCAO, 'ISENCAO']]);
const referencia = { tipo: opcao('inicioDaFase'), data: null, faseId: ID_ISENCAO };
const prazo = {
  escolha: opcao('comPrazo'),
  valor: 3,
  unidade: opcao('dias'),
  referencia,
  efeitoForaDoPrazo: opcao('recusarDocumento'),
};
const validade = {
  escolha: opcao('exigeDocumentoValido'),
  referencia,
  efeitoDoVencimento: opcao('aceitarComAviso'),
};

const semExigencias = {
  prazoDeEmissao: {
    escolha: opcao('semPrazo'),
    valor: null,
    unidade: null,
    referencia: null,
    efeitoForaDoPrazo: null,
  },
  validade: {
    escolha: opcao('naoExigeDocumentoValido'),
    referencia: null,
    efeitoDoVencimento: null,
  },
};

function enviar(requisitos: RequisitosDoDocumentoDtoProvisorio) {
  const criterios = { ...exigencia(), ...lerPrazoEValidade(requisitos, codigos) };
  return prazoEValidadeParaEnvio(criterios, FASES);
}

describe('prazo de emissão e validade do documento', () => {
  it.each(['dias', 'meses', 'anos'])('conserva a unidade %s', (unidade) => {
    const resultado = enviar({ prazoDeEmissao: { ...prazo, unidade: opcao(unidade) } });
    expect(resultado.prazoDeEmissao).toEqual({
      escolha: 'comPrazo',
      valor: 3,
      unidade,
      referencia: { tipo: 'inicioDaFase', data: null, faseId: ID_ISENCAO },
      efeitoForaDoPrazo: 'recusarDocumento',
    });
  });

  it.each(
    ['dias', 'meses', 'anos'].flatMap((unidade) =>
      ['fimDasInscricoes', 'inicioDaFase', 'fimDaFase', 'dataEspecifica', 'dataDaApresentacao'].map(
        (tipo) => ({ unidade, tipo }),
      ),
    ),
  )('conserva $unidade com referência $tipo no prazo e na validade', ({ unidade, tipo }) => {
    const data = tipo === 'dataEspecifica' ? '2027-01-30' : null;
    const faseId = tipo === 'inicioDaFase' || tipo === 'fimDaFase' ? ID_ISENCAO : null;
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
      escolha: 'semPrazo',
      valor: null,
      unidade: null,
      referencia: null,
      efeitoForaDoPrazo: null,
    });
    expect(resultado.validade).toEqual({
      escolha: 'naoExigeDocumentoValido',
      referencia: null,
      efeitoDoVencimento: null,
    });
  });

  it('omite escolhas ainda não declaradas no envio', () => {
    expect(prazoEValidadeParaEnvio(exigencia(), FASES)).toEqual({});
    expect(lerPrazoEValidade({}, codigos)).toEqual({ prazoDeEmissao: null, validade: null });
    const requisitos = comando(rascunho(exigencia()))[0].documento?.requisitos;
    expect(requisitos).not.toHaveProperty('prazoDeEmissao');
    expect(requisitos).not.toHaveProperty('validade');
  });

  it('conserva as escolhas e as fases ausentes ao reler e gravar', () => {
    const faseId = 'fase-ausente';
    const referenciaAusente = { ...referencia, faseId };
    const recebidos = {
      prazoDeEmissao: { ...prazo, referencia: referenciaAusente },
      validade: { ...validade, referencia: referenciaAusente },
    };
    const regra = exigenciaDaApi({ requisitos: recebidos });
    const resultado = comando(exigenciasDe(detalheDaApi([regra])))[0].documento?.requisitos;
    expect(resultado).toMatchObject({
      prazoDeEmissao: { escolha: 'comPrazo', referencia: { faseId } },
      validade: { escolha: 'exigeDocumentoValido', referencia: { faseId } },
    });
  });
});
