import {
  OperadorCodigo,
  type RegraDeHomologacaoDto,
  TipoDeCondicaoDeHomologacaoCodigo,
} from '@uniplus/shared-data/selecao';

import type { RegraDeHomologacao } from '../../modelos/homologacao.models';

/**
 * A regra como a API a devolve: duas alternativas (OU), a primeira com duas condições que valem
 * juntas (E), uma delas com enquadramento em duas cláusulas e a outra sem.
 */
export const REGRA_DE_HOMOLOGACAO_DO_SERVIDOR: RegraDeHomologacaoDto = {
  resultadoAtoCodigo: 'RESULTADO_HOMOLOGACAO',
  alternativas: [
    {
      condicoes: [
        {
          tipo: TipoDeCondicaoDeHomologacaoCodigo.RESULTADO_NO_RETORNO_DO_INEP,
          edicaoDoExame: 2025,
          motivoDesfavoravelCodigo: 'SEM_RESULTADO_INEP',
          enquadramento: [
            [
              { fato: 'BAIXA_RENDA', operador: OperadorCodigo.IGUAL, valor: true },
              {
                fato: 'MODALIDADE_CONVOCACAO',
                operador: OperadorCodigo.ALGUM_DE,
                valor: ['AC', 'LB_PPI'],
              },
            ],
            [{ fato: 'PERFIL', operador: OperadorCodigo.IGUAL, valor: 'EGRESSO' }],
          ],
        },
        {
          tipo: TipoDeCondicaoDeHomologacaoCodigo.RESULTADO_NO_RETORNO_DO_INEP,
          edicaoDoExame: 2024,
          motivoDesfavoravelCodigo: null,
          enquadramento: null,
        },
      ],
    },
    {
      condicoes: [
        {
          tipo: TipoDeCondicaoDeHomologacaoCodigo.RESULTADO_NO_RETORNO_DO_INEP,
          edicaoDoExame: 2023,
          motivoDesfavoravelCodigo: 'SEM_RESULTADO_INEP',
          enquadramento: null,
        },
      ],
    },
  ],
};

/** A regra de outra pessoa que gravou antes: só o ato do resultado difere da do servidor. */
export const REGRA_DE_HOMOLOGACAO_ALTERADA_NO_SERVIDOR: RegraDeHomologacaoDto = {
  ...REGRA_DE_HOMOLOGACAO_DO_SERVIDOR,
  resultadoAtoCodigo: 'COMUNICADO_HOMOLOGACAO',
};

/** As edições do ENEM que o processo precisa declarar para a regra do servidor poder ser gravada. */
export const EDICOES_DA_REGRA_DO_SERVIDOR: readonly string[] = ['2023', '2024', '2025'];

/** A mesma regra no formato do rascunho: o enquadramento vira lista com o número da cláusula. */
export const REGRA_DE_HOMOLOGACAO: RegraDeHomologacao = {
  resultadoAtoCodigo: 'RESULTADO_HOMOLOGACAO',
  alternativas: [
    {
      condicoes: [
        {
          tipo: 'RESULTADO_NO_RETORNO_DO_INEP',
          edicaoDoExame: 2025,
          motivoDesfavoravelCodigo: 'SEM_RESULTADO_INEP',
          enquadramento: [
            { clausula: 1, fato: 'BAIXA_RENDA', operador: 'IGUAL', valor: 'true' },
            {
              clausula: 1,
              fato: 'MODALIDADE_CONVOCACAO',
              operador: 'ALGUM_DE',
              valor: '["AC","LB_PPI"]',
            },
            { clausula: 2, fato: 'PERFIL', operador: 'IGUAL', valor: '"EGRESSO"' },
          ],
        },
        {
          tipo: 'RESULTADO_NO_RETORNO_DO_INEP',
          edicaoDoExame: 2024,
          motivoDesfavoravelCodigo: null,
          enquadramento: [],
        },
      ],
    },
    {
      condicoes: [
        {
          tipo: 'RESULTADO_NO_RETORNO_DO_INEP',
          edicaoDoExame: 2023,
          motivoDesfavoravelCodigo: 'SEM_RESULTADO_INEP',
          enquadramento: [],
        },
      ],
    },
  ],
};
