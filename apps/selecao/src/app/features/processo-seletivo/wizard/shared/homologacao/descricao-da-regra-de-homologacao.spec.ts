import { fatoEscolhivel, type FatoEscolhivel } from '@uniplus/shared-inscricao/formulario';
import { describe, expect, it } from 'vitest';

import type { CondicaoDeHomologacao, RegraDeHomologacao } from '../../modelos/homologacao.models';
import {
  EDICAO_NAO_ESCOLHIDA,
  HOMOLOGA_TODA_INSCRICAO_ENVIADA,
  descricaoDaCondicaoDeHomologacao,
  descricaoDaRegraDeHomologacao,
} from './descricao-da-regra-de-homologacao';
import { condicaoNova, regraNova } from './regra-de-homologacao';

const BAIXA_RENDA = fatoEscolhivel({
  codigo: 'BAIXA_RENDA',
  nome: 'Baixa renda',
  dominio: { codigo: 'SIM_OU_NAO', rotulo: 'SIM_OU_NAO' },
  binding: 'CAMPO_INSCRICAO:baixaRenda',
  operadoresAdmitidos: [{ codigo: 'IGUAL', rotulo: 'é' }],
}) as FatoEscolhivel;
const FATOS = new Map([[BAIXA_RENDA.codigo, BAIXA_RENDA]]);
const rotulo = (ano: string): string => `ENEM ${ano}`;

const doInep = (edicaoDoExame: number | null): CondicaoDeHomologacao => ({
  ...condicaoNova('RESULTADO_NO_RETORNO_DO_INEP'),
  edicaoDoExame,
});

function regraDe(...alternativas: readonly CondicaoDeHomologacao[][]): RegraDeHomologacao {
  return {
    resultadoAtoCodigo: null,
    alternativas: alternativas.map((condicoes) => ({ condicoes })),
  };
}

const descrever = (regra: RegraDeHomologacao): string =>
  descricaoDaRegraDeHomologacao(regra, FATOS, rotulo);

describe('descricaoDaRegraDeHomologacao', () => {
  it('diz que a fase homologa toda inscrição enviada quando não há condição', () => {
    expect(descrever(regraNova())).toBe(HOMOLOGA_TODA_INSCRICAO_ENVIADA);
    expect(HOMOLOGA_TODA_INSCRICAO_ENVIADA).toBe('A fase homologa toda inscrição enviada');
  });

  it('lê a condição do retorno do INEP com a edição do exame', () => {
    expect(descrever(regraDe([doInep(2025)]))).toBe(
      'resultado no retorno do INEP na edição ENEM 2025',
    );
  });

  it('avisa que a edição ainda não foi escolhida', () => {
    expect(descrever(regraDe([doInep(null)]))).toBe(
      `resultado no retorno do INEP na ${EDICAO_NAO_ESCOLHIDA}`,
    );
  });

  it('liga com "e" as condições da alternativa e com ", ou" as alternativas', () => {
    const regra = regraDe([doInep(2024), doInep(2025)], [doInep(2026)]);

    expect(descrever(regra)).toBe(
      'resultado no retorno do INEP na edição ENEM 2024 e resultado no retorno do INEP na edição ENEM 2025, ou resultado no retorno do INEP na edição ENEM 2026',
    );
  });

  it('lê a Medicina com uma alternativa por edição', () => {
    const regra = regraDe([doInep(2024)], [doInep(2025)], [doInep(2026)]);

    expect(descrever(regra).split(', ou ')).toStrictEqual([
      'resultado no retorno do INEP na edição ENEM 2024',
      'resultado no retorno do INEP na edição ENEM 2025',
      'resultado no retorno do INEP na edição ENEM 2026',
    ]);
  });

  it('diz para quem a condição vale quando ela tem enquadramento', () => {
    const condicao = {
      ...doInep(2025),
      enquadramento: [{ clausula: 1, fato: 'BAIXA_RENDA', operador: 'IGUAL', valor: 'true' }],
    };

    expect(descrever(regraDe([condicao]))).toBe(
      'resultado no retorno do INEP na edição ENEM 2025 (para quem Baixa renda é sim)',
    );
  });

  it('liga com "ou" as alternativas do enquadramento', () => {
    const condicao = {
      ...doInep(2025),
      enquadramento: [
        { clausula: 1, fato: 'BAIXA_RENDA', operador: 'IGUAL', valor: 'true' },
        { clausula: 2, fato: 'BAIXA_RENDA', operador: 'IGUAL', valor: 'false' },
      ],
    };

    expect(descrever(regraDe([condicao]))).toBe(
      'resultado no retorno do INEP na edição ENEM 2025 (para quem Baixa renda é sim ou Baixa renda é não)',
    );
  });

  it('mostra o tipo que o cliente não conhece pelo código, sem alterar as maiúsculas', () => {
    const regra = regraDe([{ ...doInep(2025), tipo: 'TIPO_NOVO_DA_API' }]);

    expect(descrever(regra)).toBe('TIPO_NOVO_DA_API na edição ENEM 2025');
  });
});

describe('descricaoDaCondicaoDeHomologacao', () => {
  it('lê uma condição sozinha, como a regra a lê dentro da alternativa', () => {
    expect(descricaoDaCondicaoDeHomologacao(doInep(2024), FATOS, rotulo)).toBe(
      'resultado no retorno do INEP na edição ENEM 2024',
    );
  });
});
