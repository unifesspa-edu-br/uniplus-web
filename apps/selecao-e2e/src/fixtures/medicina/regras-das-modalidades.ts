/**
 * A regra de aplicabilidade de cada modalidade, como a api a congela na oferta: a ampla
 * concorrência para todos, cada cota da Lei 12.711 pela opção pelas cotas e pelas condições da
 * própria cota, e a reserva de pessoa com deficiência para quem tem deficiência e quer concorrer
 * a ela, tenha optado ou não pelas cotas da lei.
 */
export const REGRAS_DE_APLICABILIDADE = {
  AC: [],
  LI_EP: [[{ fato: 'OPTOU_PELAS_COTAS_DA_LEI', operador: 'IGUAL', valor: true }]],
  LB_EP: [
    [
      { fato: 'OPTOU_PELAS_COTAS_DA_LEI', operador: 'IGUAL', valor: true },
      { fato: 'BAIXA_RENDA', operador: 'IGUAL', valor: true },
      { fato: 'CONCORRER_RENDA', operador: 'IGUAL', valor: true },
    ],
  ],
  LI_PPI: [
    [
      { fato: 'OPTOU_PELAS_COTAS_DA_LEI', operador: 'IGUAL', valor: true },
      { fato: 'COR_RACA', operador: 'EM', valor: ['PRETA', 'PARDA'] },
      { fato: 'CONCORRER_PPI', operador: 'IGUAL', valor: true },
    ],
    [
      { fato: 'OPTOU_PELAS_COTAS_DA_LEI', operador: 'IGUAL', valor: true },
      { fato: 'COR_RACA', operador: 'IGUAL', valor: 'INDIGENA' },
      { fato: 'INDIGENA', operador: 'IGUAL', valor: true },
      { fato: 'CONCORRER_PPI', operador: 'IGUAL', valor: true },
    ],
  ],
  LB_PPI: [
    [
      { fato: 'OPTOU_PELAS_COTAS_DA_LEI', operador: 'IGUAL', valor: true },
      { fato: 'COR_RACA', operador: 'EM', valor: ['PRETA', 'PARDA'] },
      { fato: 'CONCORRER_PPI', operador: 'IGUAL', valor: true },
      { fato: 'BAIXA_RENDA', operador: 'IGUAL', valor: true },
      { fato: 'CONCORRER_RENDA', operador: 'IGUAL', valor: true },
    ],
    [
      { fato: 'OPTOU_PELAS_COTAS_DA_LEI', operador: 'IGUAL', valor: true },
      { fato: 'COR_RACA', operador: 'IGUAL', valor: 'INDIGENA' },
      { fato: 'INDIGENA', operador: 'IGUAL', valor: true },
      { fato: 'CONCORRER_PPI', operador: 'IGUAL', valor: true },
      { fato: 'BAIXA_RENDA', operador: 'IGUAL', valor: true },
      { fato: 'CONCORRER_RENDA', operador: 'IGUAL', valor: true },
    ],
  ],
  LI_Q: [
    [
      { fato: 'OPTOU_PELAS_COTAS_DA_LEI', operador: 'IGUAL', valor: true },
      { fato: 'QUILOMBOLA', operador: 'IGUAL', valor: true },
      { fato: 'CONCORRER_Q', operador: 'IGUAL', valor: true },
    ],
  ],
  LB_Q: [
    [
      { fato: 'OPTOU_PELAS_COTAS_DA_LEI', operador: 'IGUAL', valor: true },
      { fato: 'QUILOMBOLA', operador: 'IGUAL', valor: true },
      { fato: 'CONCORRER_Q', operador: 'IGUAL', valor: true },
      { fato: 'BAIXA_RENDA', operador: 'IGUAL', valor: true },
      { fato: 'CONCORRER_RENDA', operador: 'IGUAL', valor: true },
    ],
  ],
  LI_PCD: [
    [
      { fato: 'OPTOU_PELAS_COTAS_DA_LEI', operador: 'IGUAL', valor: true },
      { fato: 'PCD', operador: 'IGUAL', valor: true },
      { fato: 'CONCORRER_PCD', operador: 'IGUAL', valor: true },
    ],
  ],
  LB_PCD: [
    [
      { fato: 'OPTOU_PELAS_COTAS_DA_LEI', operador: 'IGUAL', valor: true },
      { fato: 'PCD', operador: 'IGUAL', valor: true },
      { fato: 'CONCORRER_PCD', operador: 'IGUAL', valor: true },
      { fato: 'BAIXA_RENDA', operador: 'IGUAL', valor: true },
      { fato: 'CONCORRER_RENDA', operador: 'IGUAL', valor: true },
    ],
  ],
  AC_PCD: [
    [
      { fato: 'PCD', operador: 'IGUAL', valor: true },
      { fato: 'CONCORRER_PCD', operador: 'IGUAL', valor: true },
    ],
  ],
} as const;

/**
 * O que o processo ainda configura de derivação: o egresso de escola pública, da escolaridade. A
 * modalidade do candidato e a opção pelas cotas a api deriva das modalidades ofertadas.
 */
export const DERIVACOES_DA_MEDICINA = [
  {
    codigoFato: 'EGRESSO_ESCOLA_PUBLICA',
    regras: [
      {
        ordem: 0,
        contribui: null,
        quando: [
          [
            {
              fato: 'ONDE_CURSOU_EM',
              operador: 'EM',
              valor: ['SOMENTE_PUBLICA', 'COMUNITARIA_CAMPO', 'PUBLICA_E_COMUNITARIA'],
            },
          ],
          [
            {
              fato: 'FORMA_CONCLUSAO_EM',
              operador: 'EM',
              valor: ['ENCCEJA', 'PROFICIENCIA', 'ENEM'],
            },
            { fato: 'ONDE_CURSOU_EM', operador: 'IGUAL', valor: 'CERTIFICACAO' },
          ],
        ],
      },
    ],
  },
] as const;
