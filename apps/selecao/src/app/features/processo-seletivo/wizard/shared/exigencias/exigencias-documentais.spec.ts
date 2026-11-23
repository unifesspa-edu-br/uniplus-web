import { documentoExigidoNovo } from '@uniplus/shared-ui/components';
import { describe, expect, it } from 'vitest';

import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  RegraDeComprovacao,
} from '../../processo-seletivo.models';
import { comAlcanceDeTodasAsFases } from './alcance-das-exigencias';
import { exigenciasLocalizadasDaFase, todasAsExigencias } from './consulta-das-exigencias';
import {
  comExigencia,
  comRepeticao,
  exigenciaNova,
  regraDeDocumento,
  semAExigencia,
} from './exigencias-documentais';
import { ID_CONTRACHEQUE, ID_DIPLOMA, ID_RG, exigencia, rascunho } from './exigencias.testing';

/** A norma recém-declarada tem uma só definição, a do modelo de formulário e a do processo. */
describe('a base legal nova', () => {
  it('nasce igual no modelo de formulário e no processo', () => {
    const doProcesso = exigenciaNova(ID_RG, 'HABILITACAO').basesLegais;
    const doModelo = documentoExigidoNovo('HABILITACAO', 'RG').basesLegais;

    expect(doProcesso).toEqual(doModelo);
    expect(doProcesso).toEqual([
      { referencia: '', abrangencia: 'INTERNA_EDITAL', situacao: 'RESOLVIDO', observacao: null },
    ]);
  });
});

describe('operações sobre o conjunto de regras do rascunho', () => {
  it('semAExigencia remove só o par (documento, fase) indicado', () => {
    const antes = rascunho(
      exigencia({ faseCodigo: 'ISENCAO' }),
      exigencia({ faseCodigo: 'HABILITACAO' }),
    );

    const depois = semAExigencia(antes, ID_RG, 'ISENCAO');
    expect(todasAsExigencias(depois)).toHaveLength(1);
    expect(todasAsExigencias(depois)[0].faseCodigo).toBe('HABILITACAO');
  });

  it('comExigencia substitui a existente em vez de duplicar', () => {
    const antes = rascunho(exigencia());
    const depois = comExigencia(antes, exigencia({ obrigatorio: false }));

    expect(todasAsExigencias(depois)).toHaveLength(1);
    expect(todasAsExigencias(depois)[0].obrigatorio).toBe(false);
  });
});

describe('edição não atropela a regra de documento homônima do grupo', () => {
  /** O mesmo documento pode estar solto e como alternativa de um `OU` na mesma fase. */
  function soltaEAgrupada(): ExigenciasDoRascunho {
    return {
      emTodasAsFases: [],
      regrasDeComprovacao: [
        {
          forma: 'DOCUMENTO',
          documento: exigencia({ obrigatorio: true }),
          quantidadeMinima: null,
          consequencia: null,
          basesLegais: null,
          itens: null,
          criterioDeDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          grupoDoFormularioParaRepeticao: null,
        },
        {
          forma: 'QUANTIDADE_MINIMA_DE_ITENS',
          documento: null,
          quantidadeMinima: 1,
          consequencia: null,
          basesLegais: null,
          itens: [
            {
              forma: 'DOCUMENTO',
              documento: exigencia({ obrigatorio: true }),
              quantidadeMinima: null,
              consequencia: null,
              basesLegais: null,
              itens: null,
              criterioDeDistincao: null,
              dataReferencia: null,
              ocorrenciasEsperadas: null,
              grupoDoFormularioParaRepeticao: null,
            },
          ],
          criterioDeDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          grupoDoFormularioParaRepeticao: null,
        },
      ],
    };
  }

  it('comExigencia troca só a primeira regra de documento que casa', () => {
    const depois = comExigencia(soltaEAgrupada(), exigencia({ obrigatorio: false }));
    const todas = todasAsExigencias(depois);

    expect(todas).toHaveLength(2);
    expect(todas[0].obrigatorio).toBe(false);
    // A alternativa do grupo continua como estava.
    expect(todas[1].obrigatorio).toBe(true);
  });

  it('semAExigencia remove só a primeira regra de documento que casa', () => {
    const depois = semAExigencia(soltaEAgrupada(), ID_RG, 'HABILITACAO');

    expect(todasAsExigencias(depois)).toHaveLength(1);
    // O grupo sobreviveu — não foi esvaziado junto.
    expect(
      depois.regrasDeComprovacao.some((regra) => regra.forma === 'QUANTIDADE_MINIMA_DE_ITENS'),
    ).toBe(true);
  });
});

describe('a repetição pelas ocorrências de um grupo do formulário', () => {
  const repetida = (documento: ExigenciaDeDocumento, grupo: string): RegraDeComprovacao => ({
    ...regraDeDocumento(documento),
    grupoDoFormularioParaRepeticao: grupo,
  });

  it('localiza a repetição da própria regra de documento e a herdada do grupo de alternativas que se repete', () => {
    const alternativas: RegraDeComprovacao = {
      ...regraDeDocumento(exigencia()),
      forma: 'QUANTIDADE_MINIMA_DE_ITENS',
      documento: null,
      itens: [
        regraDeDocumento(exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })),
        regraDeDocumento(exigencia({ tipoDocumentoId: ID_DIPLOMA })),
      ],
      grupoDoFormularioParaRepeticao: 'FAMILIA',
    };
    const declaracoes: ExigenciasDoRascunho = {
      regrasDeComprovacao: [repetida(exigencia(), 'EMPRESAS'), alternativas],
      emTodasAsFases: [],
    };

    expect(
      exigenciasLocalizadasDaFase(declaracoes, 'HABILITACAO').map(({ repeticao }) => repeticao),
    ).toEqual([
      { grupo: 'EMPRESAS', herdada: false },
      { grupo: 'FAMILIA', herdada: true },
      { grupo: 'FAMILIA', herdada: true },
    ]);
  });

  it('declara a repetição só na regra de documento do documento na fase escolhida', () => {
    const declaracoes = rascunho(exigencia({ faseCodigo: 'ISENCAO' }), exigencia());

    const comFamilia = comRepeticao(declaracoes, ID_RG, 'HABILITACAO', 'FAMILIA');

    expect(
      comFamilia.regrasDeComprovacao.map((regra) => regra.grupoDoFormularioParaRepeticao),
    ).toEqual([null, 'FAMILIA']);
  });

  it('o documento que vale em todas as fases leva a repetição para a fase em que é materializado', () => {
    const declaracoes: ExigenciasDoRascunho = {
      regrasDeComprovacao: [repetida(exigencia({ faseCodigo: 'ISENCAO' }), 'FAMILIA')],
      emTodasAsFases: [ID_RG],
    };

    const materializada = comAlcanceDeTodasAsFases(declaracoes, ['ISENCAO', 'HABILITACAO']);

    expect(
      materializada.regrasDeComprovacao.map((regra) => [
        regra.documento?.faseCodigo,
        regra.grupoDoFormularioParaRepeticao,
      ]),
    ).toEqual([
      ['ISENCAO', 'FAMILIA'],
      ['HABILITACAO', 'FAMILIA'],
    ]);
  });
});
