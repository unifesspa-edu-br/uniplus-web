import { describe, expect, it } from 'vitest';

import {
  conteudo,
  exibidoQuando,
  grupoDeExemplo,
  item,
  secao,
} from './conteudos-de-exemplo.testing';
import {
  distribuirRecusas,
  recusasDaRestricao,
  recusasDoGrupoDeOpcoes,
  type RecusaDaRestricao,
} from './recusas';

describe('distribuirRecusas', () => {
  it('leva a recusa ao item e à etapa pelo índice enviado, e a sem índice ao resumo', () => {
    const enviado = conteudo({
      etapas: [secao('S1', 0)],
      itens: [item('A', 0, 'S1'), item('B', 1, 'S1')],
    });

    const recusas = distribuirRecusas(
      [
        { field: 'conteudo.itens[1].rotulo', message: 'Rótulo longo.' },
        { field: 'Conteudo.Etapas[0].titulo', message: 'Título vazio.' },
        { field: 'conteudo', message: 'O item B cita fato posterior.' },
      ],
      enviado,
    );

    expect(recusas.porItem.get('B')).toEqual(['Rótulo longo.']);
    expect(recusas.porEtapa.get('S1')).toEqual(['Título vazio.']);
    expect(recusas.gerais).toEqual(['O item B cita fato posterior.']);
  });

  it('a recusa da API no campo do grupo vai ao campo, e a do grupo, ao grupo', () => {
    const enviado = conteudo({ grupos: [grupoDeExemplo()] });

    const recusas = distribuirRecusas(
      [
        { field: 'conteudo.grupos[0].subitens[1].rotulo', message: 'Rótulo vazio.' },
        { field: 'conteudo.grupos[0].minimo', message: 'Mínimo incoerente.' },
      ],
      enviado,
    );

    expect(recusas.porItem.get('IDADE')).toEqual(['Rótulo vazio.']);
    expect(recusas.porGrupo.get('FAMILIA')).toEqual(['Mínimo incoerente.']);
  });
});

describe('recusa que aponta uma restrição', () => {
  const sempre = { quando: null, valores: ['MED'] };
  const quandoA = { quando: exibidoQuando('A'), valores: ['DIR'] };
  const quandoB = { quando: exibidoQuando('B'), valores: ['ENG'] };
  const opcoes = { tipo: 'OPCOES_PERMITIDAS', entradas: [sempre, quandoA, quandoB] };
  const dasRespostas = { tipo: 'OPCOES_DAS_RESPOSTAS', fatos: ['OPCOES'] };
  const enviado = conteudo({
    itens: [
      item('ESPERA', 0, 'S1', {
        apresentacao: { tipoRenderizacao: 'ESCOLHA_UNICA' },
        regras: { restricoes: [opcoes, dasRespostas] },
      }),
    ],
  });
  const recusasDe = (field: string): readonly RecusaDaRestricao[] =>
    distribuirRecusas([{ field, message: 'Recusada.' }], enviado).porRestricao.get('ESPERA') ?? [];

  it('vai ao grupo de opções que ela aponta, e a da restrição inteira, à restrição — não ao resumo do campo', () => {
    const recusas = distribuirRecusas(
      [
        {
          field: 'conteudo.itens[0].restricoes[0].entradas[1].quando',
          message: 'Condição inválida.',
        },
        { field: 'Conteudo.Itens[0].Restricoes[1].Fatos', message: 'Opções de outro domínio.' },
      ],
      enviado,
    );
    const doCampo = recusas.porRestricao.get('ESPERA') ?? [];

    expect(recusasDoGrupoDeOpcoes(doCampo, quandoA)).toEqual(['Condição inválida.']);
    expect(recusasDoGrupoDeOpcoes(doCampo, sempre)).toEqual([]);
    expect(recusasDaRestricao(doCampo, 'OPCOES_DAS_RESPOSTAS')).toEqual([
      'Opções de outro domínio.',
    ]);
    expect(recusas.porItem.size).toBe(0);
  });

  it('não passa para o grupo que ocupou a posição do grupo apontado, removido depois da recusa', () => {
    const recusas = recusasDe('conteudo.itens[0].restricoes[0].entradas[1].quando');

    // Sem o grupo apontado, o grupo seguinte é o segundo.
    expect([sempre, quandoB].flatMap((grupo) => recusasDoGrupoDeOpcoes(recusas, grupo))).toEqual(
      [],
    );
  });

  it('não passa para a restrição que ocupou a posição da restrição apontada, removida depois da recusa', () => {
    const recusas = recusasDe('conteudo.itens[0].restricoes[0].entradas');

    // Sem as opções permitidas, as opções das respostas passam a ser a primeira restrição.
    expect(recusasDaRestricao(recusas, 'OPCOES_DAS_RESPOSTAS')).toEqual([]);
  });

  it('a recusa no campo do grupo repetível vai à restrição do campo', () => {
    const comGrupo = conteudo({
      grupos: [
        {
          ...grupoDeExemplo(),
          subitens: [item('IDADE', 0, 'S1', { regras: { restricoes: [opcoes] } })],
        },
      ],
    });

    const recusas = distribuirRecusas(
      [
        {
          field: 'conteudo.grupos[0].subitens[0].restricoes[0].entradas[0].valores',
          message: 'Fora do domínio.',
        },
      ],
      comGrupo,
    );

    expect(recusasDoGrupoDeOpcoes(recusas.porRestricao.get('IDADE') ?? [], sempre)).toEqual([
      'Fora do domínio.',
    ]);
  });
});

describe('recusa da API à restrição da faixa de datas', () => {
  const dataFixa = (data: string) => ({ ancora: 'DATA_FIXA', data });

  it('leva a recusa da API à restrição da faixa, no item e no campo de grupo', () => {
    const faixa = {
      tipo: 'FAIXA_DE_DATA',
      dataMinima: dataFixa('2030-01-02'),
      dataMaxima: dataFixa('2030-01-01'),
    };
    const enviado = conteudo({
      etapas: [secao('S1', 0)],
      itens: [
        item('NASCIMENTO', 0, 'S1', {
          apresentacao: { tipoRenderizacao: 'DATA' },
          regras: { restricoes: [faixa] },
        }),
      ],
      grupos: [
        {
          codigo: 'G',
          ordem: 1,
          rotulo: 'G',
          etapaCodigo: 'S1',
          ocorrencias: { minimo: 0, maximo: null, incluiCandidato: false },
          regras: { exibicao: null, obrigatoriedade: { tipo: 'NUNCA', predicado: null } },
          subitens: [
            item('FILHO', 0, 'S1', {
              apresentacao: { tipoRenderizacao: 'DATA' },
              regras: { restricoes: [faixa] },
            }),
          ],
        },
      ],
    });

    const recusas = distribuirRecusas(
      [
        {
          field: 'conteudo.itens[0].restricoes[0]',
          message: 'A data mínima fica depois da data máxima.',
        },
        {
          field: 'Conteudo.Grupos[0].Subitens[0].Restricoes[0]',
          message: 'A faixa de data precisa de ao menos um limite.',
        },
      ],
      enviado,
    );

    expect(
      recusasDaRestricao(recusas.porRestricao.get('NASCIMENTO') ?? [], 'FAIXA_DE_DATA'),
    ).toEqual(['A data mínima fica depois da data máxima.']);
    expect(recusasDaRestricao(recusas.porRestricao.get('FILHO') ?? [], 'FAIXA_DE_DATA')).toEqual([
      'A faixa de data precisa de ao menos um limite.',
    ]);
  });
});
