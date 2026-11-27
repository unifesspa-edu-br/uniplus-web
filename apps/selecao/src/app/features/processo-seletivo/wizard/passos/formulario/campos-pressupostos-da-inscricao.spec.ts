import { comEscopoPeloCodigo } from '@uniplus/shared-data/configuracao';
import { conteudoInicial, REGRAS_INICIAIS } from '@uniplus/shared-inscricao/formulario';
import { describe, expect, it } from 'vitest';

import { CamposPostosPelasExigencias } from '../../shared/campos-postos-pelas-exigencias';
import { SECAO_OUTROS_DADOS } from './fatos-coletados-da-inscricao';
import { comCamposQueAsExigenciasPressupoem } from './campos-pressupostos-da-inscricao';
import { CATALOGO, secao, item, inscricaoGravada } from './formulario-de-inscricao.testing';

const catalogo = comEscopoPeloCodigo(CATALOGO);

describe('os campos que o processo pressupõe na inscrição', () => {
  const citados = (...fatos: string[]): ReadonlySet<string> => new Set(fatos);

  it('põe o campo citado na seção "Outros dados", criada antes do primeiro bloco do sistema e sem exibição', () => {
    const resultado = comCamposQueAsExigenciasPressupoem(inscricaoGravada(), {
      citados: citados('RENDA_FAMILIAR'),
      catalogo,
      postosPelasExigencias: CamposPostosPelasExigencias.vazia(),
      fatosDeOutrosFormularios: [],
    });

    const paginas = [...(resultado.paginas ?? [])].sort((a, b) => a.ordem - b.ordem);
    expect(paginas.map((e) => e.codigo)).toEqual([
      'DADOS_BASICOS',
      'S1',
      SECAO_OUTROS_DADOS,
      'COMPROVACAO_DOCUMENTAL',
      'REVISAO_E_ACEITE',
    ]);
    expect(paginas[2].exibicao).toBeNull();
    expect(resultado.itens?.find((i) => i.fatoCodigo === 'RENDA_FAMILIAR')).toMatchObject({
      paginaCodigo: SECAO_OUTROS_DADOS,
      apresentacao: { tipoDeCampo: 'NUMERO' },
      regras: { obrigatoriedade: { tipo: 'SEMPRE' } },
    });
  });

  /** O campo oculto para parte dos candidatos nunca dispararia o gatilho para eles. */
  it('reaproveita a seção "Outros dados" que já existe, tirando a exibição condicional dela', () => {
    const condicional = [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]];
    const base = inscricaoGravada();
    const comSecao = {
      ...base,
      paginas: [...(base.paginas ?? []), secao(SECAO_OUTROS_DADOS, 1.5, { exibicao: condicional })],
    };

    const resultado = comCamposQueAsExigenciasPressupoem(comSecao, {
      citados: citados('RENDA_FAMILIAR'),
      catalogo,
      postosPelasExigencias: CamposPostosPelasExigencias.vazia(),
      fatosDeOutrosFormularios: [],
    });

    expect(resultado.paginas?.filter((e) => e.codigo === SECAO_OUTROS_DADOS)).toHaveLength(1);
    expect(resultado.paginas?.find((e) => e.codigo === SECAO_OUTROS_DADOS)?.exibicao).toBeNull();
  });

  /** Fora da seção reservada, o fato básico seria recusado como alteração dos dados básicos. */
  it('não põe fato do conjunto básico, nem antes de o formulário existir no servidor', () => {
    expect(
      comCamposQueAsExigenciasPressupoem(conteudoInicial(), {
        citados: citados('SEXO'),
        catalogo,
        postosPelasExigencias: CamposPostosPelasExigencias.vazia(),
        fatosDeOutrosFormularios: [],
      }).itens,
    ).toEqual([]);
  });

  /** Um fato tem um único formulário que o coleta: repeti-lo na inscrição é recusado. */
  it('não põe fato que outra finalidade já coleta', () => {
    const inscricao = inscricaoGravada();
    expect(
      comCamposQueAsExigenciasPressupoem(inscricao, {
        citados: citados('RENDA_FAMILIAR'),
        catalogo,
        postosPelasExigencias: CamposPostosPelasExigencias.vazia(),
        fatosDeOutrosFormularios: ['RENDA_FAMILIAR'],
      }),
    ).toBe(inscricao);
  });

  it('não põe fato que um grupo do formulário já coleta', () => {
    const inscricao = inscricaoGravada({
      grupos: [
        {
          codigo: 'FAMILIA',
          ordem: 3,
          rotulo: 'Família',
          paginaCodigo: 'S1',
          ocorrencias: { minimo: 1, maximo: null, incluiCandidato: false },
          regras: REGRAS_INICIAIS,
          subitens: [item('RENDA_FAMILIAR', 0, 'S1')],
        },
      ],
    });
    expect(
      comCamposQueAsExigenciasPressupoem(inscricao, {
        citados: citados('RENDA_FAMILIAR'),
        catalogo,
        postosPelasExigencias: CamposPostosPelasExigencias.vazia(),
        fatosDeOutrosFormularios: [],
      }),
    ).toBe(inscricao);
  });

  it('não põe campo para fato derivado', () => {
    const inscricao = inscricaoGravada();
    expect(
      comCamposQueAsExigenciasPressupoem(inscricao, {
        citados: citados('MODALIDADE'),
        catalogo,
        postosPelasExigencias: CamposPostosPelasExigencias.vazia(),
        fatosDeOutrosFormularios: [],
      }),
    ).toBe(inscricao);
  });

  it('tira o campo que entrou sozinho e nada cita mais, e a seção que ele esvaziou', () => {
    const comCampo = comCamposQueAsExigenciasPressupoem(inscricaoGravada(), {
      citados: citados('RENDA_FAMILIAR'),
      catalogo,
      postosPelasExigencias: CamposPostosPelasExigencias.vazia(),
      fatosDeOutrosFormularios: [],
    });

    const semGatilho = comCamposQueAsExigenciasPressupoem(comCampo, {
      citados: citados(),
      catalogo,
      postosPelasExigencias: CamposPostosPelasExigencias.vazia().comOsQueEntraram([
        'RENDA_FAMILIAR',
      ]),
      fatosDeOutrosFormularios: [],
    });

    expect(semGatilho.itens?.map((i) => i.fatoCodigo)).not.toContain('RENDA_FAMILIAR');
    expect(semGatilho.paginas?.map((e) => e.codigo)).not.toContain(SECAO_OUTROS_DADOS);
  });

  /** Removê-lo apagaria no servidor uma configuração que ninguém pediu para tirar. */
  it('preserva o campo que não entrou por este mecanismo', () => {
    const inscricao = inscricaoGravada();
    expect(
      comCamposQueAsExigenciasPressupoem(inscricao, {
        citados: citados(),
        catalogo,
        postosPelasExigencias: CamposPostosPelasExigencias.vazia(),
        fatosDeOutrosFormularios: [],
      }),
    ).toBe(inscricao);
  });

  it('não tira o campo que outra regra do formulário cita', () => {
    const base = inscricaoGravada();
    const citadoPorCampo = {
      ...base,
      itens: [
        ...(base.itens ?? []),
        item('RENDA_FAMILIAR', 3, 'S1', {
          regras: {
            ...REGRAS_INICIAIS,
            exibicao: [[{ fato: 'PCD', operador: 'IGUAL', valor: true }]],
          },
        }),
      ],
    };

    expect(
      comCamposQueAsExigenciasPressupoem(citadoPorCampo, {
        citados: citados(),
        catalogo,
        postosPelasExigencias: CamposPostosPelasExigencias.vazia().comOsQueEntraram(['PCD']),
        fatosDeOutrosFormularios: [],
      }),
    ).toBe(citadoPorCampo);
  });
});
