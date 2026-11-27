import { NOME_DO_PASSO_DA_FORMULA } from '../../../processo-seletivo.data';
import { describe, expect, it } from 'vitest';

import type { CondicaoDeHomologacao } from '../../../modelos/homologacao.models';
import { umaFaseDoCronograma } from '../../../shared/fase-do-cronograma.testing';
import { condicaoNova } from '../../../shared/homologacao/regra-de-homologacao';
import {
  edicaoNaoDeclarada,
  mensagemDaEdicaoNaoDeclarada,
  problemasDaHomologacao,
} from './problemas-da-homologacao';

const doInep = (edicaoDoExame: number | null): CondicaoDeHomologacao => ({
  ...condicaoNova('RESULTADO_NO_RETORNO_DO_INEP'),
  edicaoDoExame,
});

const faseCom = (...alternativas: readonly CondicaoDeHomologacao[][]) =>
  umaFaseDoCronograma({
    regraDeHomologacao: {
      resultadoAtoCodigo: null,
      alternativas: alternativas.map((condicoes) => ({ condicoes })),
    },
  });

describe('edicaoNaoDeclarada', () => {
  it('não acusa a edição que o processo declara', () => {
    expect(edicaoNaoDeclarada(doInep(2025), ['2024', '2025'])).toBe(false);
  });

  it('acusa a edição que o processo não declara', () => {
    expect(edicaoNaoDeclarada(doInep(2023), ['2024', '2025'])).toBe(true);
  });

  it('acusa a edição quando o processo não declara nenhuma', () => {
    expect(edicaoNaoDeclarada(doInep(2025), [])).toBe(true);
  });

  it('não acusa a edição ainda não escolhida: quem a cobra é a API', () => {
    expect(edicaoNaoDeclarada(doInep(null), [])).toBe(false);
  });
});

describe('problemasDaHomologacao', () => {
  it('nomeia o campo da edição da condição que aponta edição não declarada', () => {
    const fase = faseCom([doInep(2025)], [doInep(2024), doInep(2023)]);

    const problemas = problemasDaHomologacao(fase, ['2024', '2025']);

    expect(problemas.map((problema) => problema.campo)).toEqual([
      'homologacao.alternativas.1.condicoes.1.edicaoDoExame',
    ]);
    expect(problemas[0].mensagem).toBe(mensagemDaEdicaoNaoDeclarada(doInep(2023)));
  });

  it('diz de qual edição se trata e onde declará-la', () => {
    expect(mensagemDaEdicaoNaoDeclarada(doInep(2023))).toBe(
      `A edição ENEM 2023 não está entre as que o processo declara. Escolha uma edição declarada ou declare esta no passo ${NOME_DO_PASSO_DA_FORMULA}.`,
    );
  });

  it('não acusa a fase sem regra', () => {
    expect(problemasDaHomologacao(umaFaseDoCronograma({}), [])).toEqual([]);
  });

  it('não acusa a regra cujas edições o processo declara', () => {
    expect(
      problemasDaHomologacao(faseCom([doInep(2024)], [doInep(2025)]), ['2024', '2025']),
    ).toEqual([]);
  });
});
