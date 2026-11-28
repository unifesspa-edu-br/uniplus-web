import { describe, expect, it } from 'vitest';

import type { ExigenciaDeDocumento } from '../../processo-seletivo.models';
import {
  APLICABILIDADE_CONDICIONAL,
  exigenciaNova,
} from '../../shared/exigencias/exigencias-documentais';
import { comModalidades } from '../../shared/exigencias/modalidades-da-exigencia';
import {
  alcancaOPublico,
  descreverCondicaoDeModalidade,
  descreverPublico,
  filtroDoValor,
  opcaoDoFiltro,
  publicoDaExigencia,
  rotulosDasCondicoesDe,
} from './resumo-da-exigencia';

const SEM_FATOS = new Map();

/** A exigência "de quem satisfaz" com as condições dadas, por cláusula. */
function condicional(
  condicoes: ExigenciaDeDocumento['condicoes'],
  modalidades: readonly string[] | null = null,
): ExigenciaDeDocumento {
  const base = comModalidades(
    { ...exigenciaNova('DOC', 'HABILITACAO'), aplicabilidade: APLICABILIDADE_CONDICIONAL },
    modalidades,
  );
  return { ...base, condicoes: [...base.condicoes, ...condicoes] };
}

describe('resumo da exigência documental: modalidade como "código — nome"', () => {
  /** O rótulo só muda a exibição: o código segue como valor do filtro e como chave de busca. */
  const ROTULOS = new Map([['ZZ_TESTE', 'ZZ_TESTE — Modalidade de teste Alfa']]);

  it('nomeia a restrição às modalidades, e só o código quando falta o nome', () => {
    const publico = publicoDaExigencia(condicional([], ['ZZ_TESTE', 'ZZ_SEM_NOME']), SEM_FATOS);

    expect(descreverPublico(publico, ROTULOS)).toBe(
      'Modalidades ZZ_TESTE — Modalidade de teste Alfa, ZZ_SEM_NOME',
    );
    expect(publico.modalidades).toEqual(['ZZ_TESTE', 'ZZ_SEM_NOME']);
  });

  it('nomeia a condição de modalidade de cada operador', () => {
    const frase = (operador: string, valor: string) =>
      descreverCondicaoDeModalidade({ fato: 'MODALIDADE', operador, valor }, ROTULOS);

    expect(frase('IGUAL', '"ZZ_TESTE"')).toBe('Modalidade ZZ_TESTE — Modalidade de teste Alfa');
    expect(frase('NENHUM_DE', '["ZZ_TESTE","ZZ_SEM_NOME"]')).toBe(
      'Modalidades exceto ZZ_TESTE — Modalidade de teste Alfa, ZZ_SEM_NOME',
    );
  });

  it('nomeia a condição que fica dentro da alternativa', () => {
    const igual = condicional([
      { clausula: 1, fato: 'MODALIDADE', operador: 'IGUAL', valor: '"ZZ_TESTE"' },
    ]);

    expect(descreverPublico(publicoDaExigencia(igual, SEM_FATOS, ROTULOS), ROTULOS)).toBe(
      'Quem: Modalidade ZZ_TESTE — Modalidade de teste Alfa',
    );
  });

  it('rotula a opção do filtro e mantém o código no valor', () => {
    expect(opcaoDoFiltro('modalidade:ZZ_TESTE', ROTULOS)).toEqual({
      valor: 'modalidade:ZZ_TESTE',
      rotulo: 'Candidato de ZZ_TESTE — Modalidade de teste Alfa',
    });
    expect(opcaoDoFiltro('modalidade:ZZ_SEM_NOME', ROTULOS).rotulo).toBe(
      'Candidato de ZZ_SEM_NOME',
    );
  });

  it('filtra pelo código, não pelo rótulo', () => {
    const publico = publicoDaExigencia(condicional([], ['ZZ_TESTE']), SEM_FATOS, ROTULOS);

    expect(alcancaOPublico(publico, { tipo: 'modalidade', codigo: 'ZZ_TESTE' })).toBe(true);
    expect(
      alcancaOPublico(publico, { tipo: 'modalidade', codigo: ROTULOS.get('ZZ_TESTE') ?? '' }),
    ).toBe(false);
  });
});

describe('resumo da exigência documental: o filtro por condição de modalidade', () => {
  const exigencia = condicional([
    { clausula: 1, fato: 'MODALIDADE', operador: 'IGUAL', valor: '"ZZ_TESTE"' },
  ]);
  const rotuloAlfa = new Map([['ZZ_TESTE', 'ZZ_TESTE — Modalidade de teste Alfa']]);
  const rotuloRenomeado = new Map([['ZZ_TESTE', 'ZZ_TESTE — Outro nome']]);

  it('guarda a condição pelos códigos e só rotula na apresentação', () => {
    const publico = publicoDaExigencia(exigencia, SEM_FATOS, rotuloAlfa);

    expect(publico.alternativas).toEqual([['Modalidade ZZ_TESTE']]);
    expect(publico.alternativasRotuladas).toEqual([
      ['Modalidade ZZ_TESTE — Modalidade de teste Alfa'],
    ]);
  });

  it('segue casando o filtro escolhido depois de o nome da modalidade mudar', () => {
    const antes = publicoDaExigencia(exigencia, SEM_FATOS, rotuloAlfa);
    const depois = publicoDaExigencia(exigencia, SEM_FATOS, rotuloRenomeado);
    const valor = `condicao:${[...rotulosDasCondicoesDe([antes]).keys()][0]}`;
    const filtro = filtroDoValor(valor);

    expect(alcancaOPublico(depois, filtro)).toBe(true);
    expect(opcaoDoFiltro(valor, undefined, rotulosDasCondicoesDe([depois])).rotulo).toBe(
      'Candidato com: Modalidade ZZ_TESTE — Outro nome',
    );
  });
});

describe('resumo da exigência documental: o filtro por fato cujos valores são modalidades', () => {
  const exigencia = condicional([
    { clausula: 1, fato: 'MODALIDADE_CONVOCACAO', operador: 'IGUAL', valor: '"ZZ_TESTE"' },
  ]);
  const fatosCom = (rotulo: string) =>
    new Map([
      [
        'MODALIDADE_CONVOCACAO',
        {
          codigo: 'MODALIDADE_CONVOCACAO',
          nome: 'Modalidade da convocação',
          tipoDominio: 'CATEGORICO_DINAMICO' as const,
          operadoresAdmitidos: [{ codigo: 'IGUAL', rotulo: 'é' }],
          valores: ['ZZ_TESTE'],
          rotulos: new Map([['ZZ_TESTE', rotulo]]),
          coletavel: false,
        },
      ],
    ]);
  const alfa = 'ZZ_TESTE — Modalidade de teste Alfa';
  const outro = 'ZZ_TESTE — Outro nome';

  it('mostra "código — nome" e guarda a condição só pelos códigos', () => {
    const publico = publicoDaExigencia(exigencia, fatosCom(alfa), new Map([['ZZ_TESTE', alfa]]));

    expect(publico.alternativasRotuladas[0][0]).toContain(alfa);
    expect(publico.alternativas[0][0]).not.toContain('Modalidade de teste Alfa');
  });

  it('segue casando o filtro escolhido depois de o nome mudar', () => {
    const antes = publicoDaExigencia(exigencia, fatosCom(alfa), new Map([['ZZ_TESTE', alfa]]));
    const depois = publicoDaExigencia(exigencia, fatosCom(outro), new Map([['ZZ_TESTE', outro]]));
    const valor = `condicao:${[...rotulosDasCondicoesDe([antes]).keys()][0]}`;

    expect(alcancaOPublico(depois, filtroDoValor(valor))).toBe(true);
    expect(opcaoDoFiltro(valor, undefined, rotulosDasCondicoesDe([depois])).rotulo).toContain(
      outro,
    );
  });
});
