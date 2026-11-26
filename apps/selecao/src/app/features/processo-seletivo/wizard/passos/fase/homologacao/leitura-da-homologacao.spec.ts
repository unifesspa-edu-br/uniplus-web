import { fatoEscolhivel, type FatoEscolhivel } from '@uniplus/shared-inscricao/formulario';
import { describe, expect, it } from 'vitest';

import { REGRA_DE_HOMOLOGACAO } from '../../../shared/homologacao/regra-de-homologacao.testing';
import {
  linhasDaRegraDeHomologacao,
  MOTIVO_NAO_APONTADO,
  type NomesDaLeitura,
} from './leitura-da-homologacao';

const BAIXA_RENDA = fatoEscolhivel({
  codigo: 'BAIXA_RENDA',
  nome: 'Baixa renda',
  dominio: { codigo: 'SIM_OU_NAO', rotulo: 'SIM_OU_NAO' },
  binding: 'CAMPO_INSCRICAO:baixaRenda',
  operadoresAdmitidos: [{ codigo: 'IGUAL', rotulo: 'é' }],
}) as FatoEscolhivel;

const NOMES: NomesDaLeitura = {
  fatos: new Map([[BAIXA_RENDA.codigo, BAIXA_RENDA]]),
  edicao: (ano) => `ENEM ${ano}`,
  motivo: (codigo) => `Motivo ${codigo}`,
};

describe('linhasDaRegraDeHomologacao', () => {
  it('escreve cada condição com a alternativa a que pertence e o motivo que aponta', () => {
    const linhas = linhasDaRegraDeHomologacao(
      {
        resultadoAtoCodigo: null,
        alternativas: [
          { condicoes: [{ ...REGRA_DE_HOMOLOGACAO.alternativas[0].condicoes[1] }] },
          { condicoes: [REGRA_DE_HOMOLOGACAO.alternativas[1].condicoes[0]] },
        ],
      },
      NOMES,
    );

    expect(linhas).toEqual([
      `Alternativa 1, condição 1: resultado no retorno do INEP na edição ENEM 2024. Motivo desfavorável: ${MOTIVO_NAO_APONTADO}.`,
      'Alternativa 2, condição 1: resultado no retorno do INEP na edição ENEM 2023. Motivo desfavorável: Motivo SEM_RESULTADO_INEP.',
    ]);
  });

  it('não escreve linha para a regra sem alternativa', () => {
    expect(
      linhasDaRegraDeHomologacao({ resultadoAtoCodigo: null, alternativas: [] }, NOMES),
    ).toEqual([]);
  });
});
