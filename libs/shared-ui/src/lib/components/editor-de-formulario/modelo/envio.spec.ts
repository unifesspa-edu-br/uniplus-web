import { describe, expect, it } from 'vitest';

import { conteudo, item, secao } from './conteudos-de-exemplo.testing';
import { conteudoParaEnvio, semDadosBasicos } from './envio';
import type { GrupoDoFormulario } from './tipos';

describe('semDadosBasicos', () => {
  it('o envio deixa de fora a seção dos dados básicos, que a API repõe', () => {
    const atual = conteudo({
      paginas: [secao('DADOS_BASICOS', 0), secao('S1', 1)],
      itens: [item('NOME', 0, 'DADOS_BASICOS'), item('A', 1, 'S1')],
    });

    const enviado = semDadosBasicos(atual);

    expect(enviado.paginas?.map((e) => e.codigo)).toEqual(['S1']);
    expect(enviado.itens?.map((i) => i.fatoCodigo)).toEqual(['A']);
  });
});

describe('conteudoParaEnvio', () => {
  const comLimites = (
    minimo: number | string,
    anos: number | string,
    minimoDoGrupo: number | string = 1,
  ) =>
    conteudo({
      itens: [
        item('IDADE', 0, 'S1', {
          regras: {
            restricoes: [
              { tipo: 'FAIXA_NUMERICA', minimo, maximo: null },
              {
                tipo: 'FAIXA_DE_DATA',
                dataMinima: { ancora: 'ENVIO', anos, dias: 0 },
                dataMaxima: null,
              },
            ],
          },
        }),
      ],
      grupos: [
        { ...grupo(), ocorrencias: { minimo: minimoDoGrupo, maximo: '3', incluiCandidato: false } },
      ],
    });

  function grupo(): GrupoDoFormulario {
    return {
      codigo: 'G',
      ordem: 1,
      rotulo: 'Grupo',
      paginaCodigo: 'S1',
      ocorrencias: { minimo: 1, maximo: null, incluiCandidato: false },
      regras: { exibicao: null, obrigatoriedade: { tipo: null, predicado: null } },
      subitens: [],
    };
  }

  it('converte o número digitado em texto e mantém o que já é número', () => {
    const enviado = conteudoParaEnvio(comLimites('18', -18));

    expect(enviado?.itens?.[0].regras.restricoes?.[0].minimo).toBe(18);
    expect(enviado?.itens?.[0].regras.restricoes?.[1].dataMinima?.anos).toBe(-18);
    expect(enviado?.grupos?.[0].ocorrencias.maximo).toBe(3);
  });

  it.each([
    ['limite da faixa', comLimites('abc', 0)],
    ['deslocamento da data', comLimites(1, 'dez')],
    ['mínimo do grupo', comLimites(1, 0, ' ')],
  ])('recusa o %s que não é número, em vez de mandá-lo em texto', (_nome, rascunho) => {
    expect(conteudoParaEnvio(rascunho)).toBeNull();
  });
});
