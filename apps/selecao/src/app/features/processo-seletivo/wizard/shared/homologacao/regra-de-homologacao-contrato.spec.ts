import type { RegraDeHomologacaoDto } from '@uniplus/shared-data/selecao';
import { describe, expect, it } from 'vitest';

import { regraComoInput, regraDoDto } from './regra-de-homologacao-contrato';
import {
  REGRA_DE_HOMOLOGACAO,
  REGRA_DE_HOMOLOGACAO_DO_SERVIDOR,
} from './regra-de-homologacao.testing';

describe('regraDoDto', () => {
  it('devolve a fase sem a regra como nula, venha o campo nulo ou ausente', () => {
    expect(regraDoDto(null)).toBeNull();
    expect(regraDoDto(undefined)).toBeNull();
  });

  it('traz o resultado, as alternativas e as condições como a API as devolveu', () => {
    expect(regraDoDto(REGRA_DE_HOMOLOGACAO_DO_SERVIDOR)).toStrictEqual(REGRA_DE_HOMOLOGACAO);
  });

  it('numera as cláusulas do enquadramento a partir de um', () => {
    const regra = regraDoDto(REGRA_DE_HOMOLOGACAO_DO_SERVIDOR);

    const numeros = regra?.alternativas[0].condicoes[0].enquadramento.map((item) => item.clausula);

    expect(numeros).toStrictEqual([1, 1, 2]);
  });

  it('lê a regra vazia, sem alternativa, como regra declarada', () => {
    const vazia: RegraDeHomologacaoDto = { resultadoAtoCodigo: null, alternativas: [] };

    expect(regraDoDto(vazia)).toStrictEqual({ resultadoAtoCodigo: null, alternativas: [] });
  });
});

describe('regraComoInput', () => {
  it('leva a fase sem a regra como nula', () => {
    expect(regraComoInput(null)).toBeNull();
  });

  it('devolve à API a regra que dela recebeu, inclusive o enquadramento', () => {
    expect(regraComoInput(regraDoDto(REGRA_DE_HOMOLOGACAO_DO_SERVIDOR))).toStrictEqual(
      REGRA_DE_HOMOLOGACAO_DO_SERVIDOR,
    );
  });

  it('leva a condição sem enquadramento com o enquadramento nulo', () => {
    const input = regraComoInput(REGRA_DE_HOMOLOGACAO);

    expect(input?.alternativas?.[0].condicoes?.[1].enquadramento).toBeNull();
  });

  it('leva o que a regra ainda não tem como nulo, para o servidor recusar pelo campo', () => {
    const regra = {
      resultadoAtoCodigo: null,
      alternativas: [
        {
          condicoes: [
            {
              tipo: 'RESULTADO_NO_RETORNO_DO_INEP',
              edicaoDoExame: null,
              motivoDesfavoravelCodigo: null,
              enquadramento: [],
            },
          ],
        },
      ],
    };

    expect(regraComoInput(regra)).toStrictEqual({
      resultadoAtoCodigo: null,
      alternativas: [
        {
          condicoes: [
            {
              tipo: 'RESULTADO_NO_RETORNO_DO_INEP',
              edicaoDoExame: null,
              motivoDesfavoravelCodigo: null,
              enquadramento: null,
            },
          ],
        },
      ],
    });
  });

  it('mantém a alternativa sem condição, para o servidor recusá-la pelo campo', () => {
    const regra = {
      resultadoAtoCodigo: 'RESULTADO_HOMOLOGACAO',
      alternativas: [{ condicoes: [] }],
    };

    expect(regraComoInput(regra)?.alternativas).toStrictEqual([{ condicoes: [] }]);
  });
});
