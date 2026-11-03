import { describe, expect, it } from 'vitest';

import type {
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  NoDeExigencia,
} from '../../processo-seletivo.models';
import { comAlcanceDeTodasAsFases } from './alcance-das-exigencias';
import { exigenciasLocalizadasDaFase, todasAsExigencias } from './consulta-das-exigencias';
import {
  comExigencia,
  comRepeticao,
  folhaDe,
  semAEtapa,
  semAExigencia,
  semAFase,
} from './exigencias-documentais';
import {
  ID_CONTRACHEQUE,
  ID_DIPLOMA,
  ID_ETAPA_RENDA,
  ID_RG,
  exigencia,
  rascunho,
} from './exigencias.testing';

describe('operações sobre a árvore do rascunho', () => {
  it('semAFase tira a exigência daquela fase e deixa a das outras', () => {
    const antes = rascunho(
      exigencia({ faseCodigo: 'ISENCAO' }),
      exigencia({ faseCodigo: 'HABILITACAO' }),
    );

    const depois = semAFase(antes, 'ISENCAO');
    expect(todasAsExigencias(depois)).toHaveLength(1);
    expect(todasAsExigencias(depois)[0].faseCodigo).toBe('HABILITACAO');
  });

  it('semAEtapa devolve o documento à fase inteira', () => {
    const depois = semAEtapa(rascunho(exigencia({ etapaId: ID_ETAPA_RENDA })), ID_ETAPA_RENDA);
    expect(todasAsExigencias(depois)[0].etapaId).toBeNull();
  });

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

describe('edição não atropela a folha homônima do grupo', () => {
  /** O mesmo documento pode estar solto e como alternativa de um `OU` na mesma fase. */
  function soltaEAgrupada(): ExigenciasDoRascunho {
    return {
      emTodasAsFases: [],
      raizes: [
        {
          tipo: 'FOLHA',
          documento: exigencia({ obrigatorio: true }),
          quantidadeMinima: null,
          consequencia: null,
          basesLegais: null,
          filhos: null,
          chaveDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          repetePorEntidade: null,
        },
        {
          tipo: 'OU',
          documento: null,
          quantidadeMinima: 1,
          consequencia: null,
          basesLegais: null,
          filhos: [
            {
              tipo: 'FOLHA',
              documento: exigencia({ obrigatorio: true }),
              quantidadeMinima: null,
              consequencia: null,
              basesLegais: null,
              filhos: null,
              chaveDistincao: null,
              dataReferencia: null,
              ocorrenciasEsperadas: null,
              repetePorEntidade: null,
            },
          ],
          chaveDistincao: null,
          dataReferencia: null,
          ocorrenciasEsperadas: null,
          repetePorEntidade: null,
        },
      ],
    };
  }

  it('comExigencia troca só a primeira folha que casa', () => {
    const depois = comExigencia(soltaEAgrupada(), exigencia({ obrigatorio: false }));
    const todas = todasAsExigencias(depois);

    expect(todas).toHaveLength(2);
    expect(todas[0].obrigatorio).toBe(false);
    // A alternativa do grupo continua como estava.
    expect(todas[1].obrigatorio).toBe(true);
  });

  it('semAExigencia remove só a primeira folha que casa', () => {
    const depois = semAExigencia(soltaEAgrupada(), ID_RG, 'HABILITACAO');

    expect(todasAsExigencias(depois)).toHaveLength(1);
    // O grupo sobreviveu — não foi esvaziado junto.
    expect(depois.raizes.some((no) => no.tipo === 'OU')).toBe(true);
  });
});

describe('a repetição pelas ocorrências de um grupo do formulário', () => {
  const repetida = (documento: ExigenciaDeDocumento, grupo: string): NoDeExigencia => ({
    ...folhaDe(documento),
    repetePorEntidade: grupo,
  });

  it('localiza a repetição da própria folha e a herdada do grupo de alternativas que se repete', () => {
    const alternativas: NoDeExigencia = {
      ...folhaDe(exigencia()),
      tipo: 'OU',
      documento: null,
      filhos: [
        folhaDe(exigencia({ tipoDocumentoId: ID_CONTRACHEQUE })),
        folhaDe(exigencia({ tipoDocumentoId: ID_DIPLOMA })),
      ],
      repetePorEntidade: 'FAMILIA',
    };
    const arvore: ExigenciasDoRascunho = {
      raizes: [repetida(exigencia(), 'EMPRESAS'), alternativas],
      emTodasAsFases: [],
    };

    expect(
      exigenciasLocalizadasDaFase(arvore, 'HABILITACAO').map(({ repeticao }) => repeticao),
    ).toEqual([
      { grupo: 'EMPRESAS', herdada: false },
      { grupo: 'FAMILIA', herdada: true },
      { grupo: 'FAMILIA', herdada: true },
    ]);
  });

  it('declara a repetição só na folha do documento na fase escolhida', () => {
    const arvore = rascunho(exigencia({ faseCodigo: 'ISENCAO' }), exigencia());

    const comFamilia = comRepeticao(arvore, ID_RG, 'HABILITACAO', 'FAMILIA');

    expect(comFamilia.raizes.map((no) => no.repetePorEntidade)).toEqual([null, 'FAMILIA']);
  });

  it('o documento que vale em todas as fases leva a repetição para a fase em que é materializado', () => {
    const arvore: ExigenciasDoRascunho = {
      raizes: [repetida(exigencia({ faseCodigo: 'ISENCAO' }), 'FAMILIA')],
      emTodasAsFases: [ID_RG],
    };

    const materializada = comAlcanceDeTodasAsFases(arvore, ['ISENCAO', 'HABILITACAO']);

    expect(
      materializada.raizes.map((no) => [no.documento?.faseCodigo, no.repetePorEntidade]),
    ).toEqual([
      ['ISENCAO', 'FAMILIA'],
      ['HABILITACAO', 'FAMILIA'],
    ]);
  });
});
