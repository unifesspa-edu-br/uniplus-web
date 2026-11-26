import {
  DADO_OPCAO,
  DADO_SIM_OU_NAO,
  ORIGEM_CALCULADA,
  VALORES_MODALIDADE,
} from './valores-do-catalogo.testing';
import { describe, expect, it } from 'vitest';

import {
  EscopoFatoCodigo,
  type FatoCandidatoComOperadores,
} from '@uniplus/shared-data/configuracao';
import { codigoComRotulo } from '@uniplus/shared-testing/contrato';

import {
  dominiosDoGatilho,
  fatosDoGatilhoNaFase,
  recusasDeFaseDoGatilho,
  type FatoEscolhivel,
} from './gatilho-de-exigencia';
import { MODALIDADE, exigencia, view } from './gatilho-de-exigencia.testing';
import type { FatoComFase, ProducaoDosFatos } from './producao-dos-fatos';

describe('os fatos que o gatilho oferece na fase da exigência', () => {
  const doProcesso = (
    parcial: Partial<FatoCandidatoComOperadores> & Pick<FatoCandidatoComOperadores, 'codigo'>,
  ): Omit<FatoCandidatoComOperadores, 'escopo'> & FatoComFase => {
    const fato = view({
      escopo: codigoComRotulo(EscopoFatoCodigo.CANDIDATO, 'Candidato'),
      ativo: true,
      fonteValores: null,
      binding: `CAMPO_FORMULARIO:${parcial.codigo}`,
      ...parcial,
    });
    return { ...fato, escopo: fato.escopo?.codigo ?? '' };
  };

  const DEFICIENCIA = doProcesso({
    codigo: 'PCD',
    nome: 'Pessoa com deficiência',
    dominio: DADO_SIM_OU_NAO,
  });
  const LAUDO = doProcesso({
    codigo: 'LAUDO_RECENTE',
    nome: 'Laudo recente',
    dominio: DADO_SIM_OU_NAO,
  });
  const CONVOCACAO = doProcesso({
    codigo: 'MODALIDADE_CONVOCACAO',
    nome: 'Modalidade da convocação',
    fonteValores: VALORES_MODALIDADE,
    origem: ORIGEM_CALCULADA,
    binding: 'CLASSIFICACAO:MODALIDADE_CONVOCACAO',
    pontoResolucao: 'RESULTADO_FINAL',
  });
  const CONCORRENCIA = doProcesso({ ...MODALIDADE, fonteValores: VALORES_MODALIDADE });
  const FATOS = [DEFICIENCIA, LAUDO, CONVOCACAO, CONCORRENCIA];

  const PRODUCAO: ProducaoDosFatos = {
    fases: [
      { codigo: 'INSCRICAO', ordem: 1, finalidades: ['INSCRICAO'] },
      { codigo: 'RESULTADO_FINAL', ordem: 2, finalidades: [] },
      { codigo: 'HABILITACAO', ordem: 3, finalidades: ['HABILITACAO'] },
    ],
    formularios: [
      { finalidade: 'INSCRICAO', faseCodigo: 'INSCRICAO', fatos: new Set(['PCD']) },
      { finalidade: 'HABILITACAO', faseCodigo: 'HABILITACAO', fatos: new Set(['LAUDO_RECENTE']) },
    ],
    derivacoes: new Map(),
    catalogo: new Map(FATOS.map((fato) => [fato.codigo, fato])),
    grupos: new Map(),
  };
  const MODALIDADES = ['AC', 'LB_PPI'];
  const DOMINIOS = dominiosDoGatilho(
    FATOS.map((fato) => ({
      ...fato,
      escopo: codigoComRotulo(fato.escopo as EscopoFatoCodigo, fato.escopo),
    })),
    [],
    MODALIDADES,
  );
  const codigos = (fatos: readonly FatoEscolhivel[]): readonly string[] =>
    fatos.map((fato) => fato.codigo);
  const na = (faseCodigo: string, finalidade: string | null = null) => ({ faseCodigo, finalidade });

  it('na habilitação, os fatos de todos os formulários e a modalidade da convocação, com as modalidades ofertadas', () => {
    const oferecidos = fatosDoGatilhoNaFase(FATOS, na('HABILITACAO'), {
      producao: PRODUCAO,
      dominiosDinamicos: DOMINIOS,
    });

    expect(codigos(oferecidos)).toEqual(['PCD', 'LAUDO_RECENTE', 'MODALIDADE_CONVOCACAO']);
    expect(oferecidos.find((fato) => fato.codigo === 'MODALIDADE_CONVOCACAO')?.valores).toEqual(
      MODALIDADES,
    );
  });

  it('na inscrição, só o que já é conhecido nela', () => {
    expect(
      codigos(
        fatosDoGatilhoNaFase(FATOS, na('INSCRICAO'), {
          producao: PRODUCAO,
          dominiosDinamicos: DOMINIOS,
        }),
      ),
    ).toEqual(['PCD']);
  });

  it('na fase que divide inscrição e isenção, o documento da inscrição não oferece o fato que só a isenção coleta', () => {
    const BOLSISTA = doProcesso({ codigo: 'BOLSISTA', nome: 'Bolsista', dominio: DADO_SIM_OU_NAO });
    const dividida: ProducaoDosFatos = {
      ...PRODUCAO,
      fases: [
        { codigo: 'INSCRICAO', ordem: 1, finalidades: ['INSCRICAO', 'ISENCAO_TAXA'] },
        ...PRODUCAO.fases.slice(1),
      ],
      formularios: [
        ...PRODUCAO.formularios,
        { finalidade: 'ISENCAO_TAXA', faseCodigo: 'INSCRICAO', fatos: new Set(['BOLSISTA']) },
      ],
      catalogo: new Map([...PRODUCAO.catalogo, ['BOLSISTA', BOLSISTA]]),
    };
    const oferecidos = (finalidade: string) =>
      codigos(
        fatosDoGatilhoNaFase([...FATOS, BOLSISTA], na('INSCRICAO', finalidade), {
          producao: dividida,
          dominiosDinamicos: DOMINIOS,
        }),
      );

    expect(oferecidos('INSCRICAO')).toEqual(['PCD']);
    expect(oferecidos('ISENCAO_TAXA')).toEqual(['PCD', 'BOLSISTA']);
  });

  it('o fato que a exigência já cita e não pode citar vem por último, marcado', () => {
    const oferecidos = fatosDoGatilhoNaFase(FATOS, na('INSCRICAO'), {
      producao: PRODUCAO,
      dominiosDinamicos: DOMINIOS,
      citados: ['LAUDO_RECENTE'],
    });

    expect(codigos(oferecidos)).toEqual(['PCD', 'LAUDO_RECENTE']);
    expect(oferecidos[1]?.nome).toBe('Laudo recente (não citável nesta exigência)');
  });

  it('o fato que aguarda a aprovação da proteção de dados segue na lista, sinalizado para o editor tratá-lo como indisponível', () => {
    const pendente: FatoComFase = { ...DEFICIENCIA, protecaoAprovada: false };
    const catalogo = FATOS.map((fato) => (fato.codigo === 'PCD' ? pendente : fato));
    const producao: ProducaoDosFatos = {
      ...PRODUCAO,
      catalogo: new Map(catalogo.map((fato) => [fato.codigo, fato])),
    };

    const oferecidos = fatosDoGatilhoNaFase(catalogo, na('INSCRICAO'), {
      producao,
      dominiosDinamicos: DOMINIOS,
    });

    expect(codigos(oferecidos)).toEqual(['PCD']);
    expect(oferecidos[0]?.aguardaProtecao).toBe(true);
  });

  it('as modalidades valem para todo fato cujos valores são modalidades, não só pelo código', () => {
    expect(DOMINIOS.get('MODALIDADE_CONVOCACAO')).toEqual(MODALIDADES);
    expect(DOMINIOS.get('MODALIDADE')).toEqual(MODALIDADES);
  });

  describe('o campo de membro de grupo repetível', () => {
    const PARENTESCO = doProcesso({
      codigo: 'PARENTESCO',
      nome: 'Parentesco',
      dominio: DADO_OPCAO,
      valoresDominio: ['FILHO', 'CONJUGE'],
      escopo: codigoComRotulo(EscopoFatoCodigo.MEMBRO_GRUPO, 'Membro do grupo'),
    });
    const comParentesco: ProducaoDosFatos = {
      ...PRODUCAO,
      catalogo: new Map([...PRODUCAO.catalogo, ['PARENTESCO', PARENTESCO]]),
    };

    it('só é oferecido ao documento que se repete pelo grupo que o coleta', () => {
      const oferecidos = (repeticao: ReadonlySet<string>) =>
        codigos(
          fatosDoGatilhoNaFase([...FATOS, PARENTESCO], na('INSCRICAO'), {
            producao: comParentesco,
            dominiosDinamicos: DOMINIOS,
            camposDaRepeticao: repeticao,
          }),
        );

      expect(oferecidos(new Set())).toEqual(['PCD']);
      expect(oferecidos(new Set(['PARENTESCO']))).toEqual(['PCD', 'PARENTESCO']);
    });

    it('citado fora da repetição, recusa a condição e leva ao grupo que o coleta', () => {
      const comFamilia: ProducaoDosFatos = {
        ...comParentesco,
        grupos: new Map([
          ['FAMILIA', { codigo: 'FAMILIA', rotulo: 'Composição familiar', campos: ['PARENTESCO'] }],
        ]),
      };
      const documento = exigencia({
        condicoes: [{ clausula: 1, fato: 'PARENTESCO', operador: 'IGUAL', valor: 'FILHO' }],
      });
      const nomes = { fato: (codigo: string) => codigo, fase: (codigo: string) => codigo };

      expect(recusasDeFaseDoGatilho(documento, comFamilia, nomes)).toEqual([
        {
          indice: 0,
          orientacao:
            '“PARENTESCO” é campo do grupo “Composição familiar” e só condiciona documento que se repete por ele. ' +
            'Como resolver: escolha “Composição familiar” em “Repetir por”; ou retire esta condição.',
        },
      ]);
      expect(recusasDeFaseDoGatilho(documento, comFamilia, nomes, new Set(['PARENTESCO']))).toEqual(
        [],
      );
    });
  });

  it('a recusa de fase vem na posição da condição que cita o fato', () => {
    const documento = exigencia({
      condicoes: [
        { clausula: 1, fato: 'PCD', operador: 'IGUAL', valor: 'true' },
        { clausula: 1, fato: 'LAUDO_RECENTE', operador: 'IGUAL', valor: 'true' },
      ],
    });

    const recusas = recusasDeFaseDoGatilho(documento, PRODUCAO, {
      fato: (codigo) => codigo,
      fase: (codigo) => codigo,
    });

    expect(recusas.map((recusa) => recusa.indice)).toEqual([1]);
    expect(recusas[0]?.orientacao).toContain(
      'Como resolver: exija o documento na fase HABILITACAO',
    );
  });
});
