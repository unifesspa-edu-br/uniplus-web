/** O fato como a leitura administrativa o devolve: no envelope. */
export const emManutencao = (fato: object) => ({ fato, operadoresAdmitidos: [] });

/** Fato declarado de sim ou não, como a rota administrativa o devolve. */
export const FATO = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'TRABALHA',
  descritivo: {
    nome: 'Trabalha',
    descricao: 'Se o candidato trabalha.',
    componenteExibicao: null,
  },
  definicao: {
    dominio: 'SIM_OU_NAO',
    cardinalidade: 'ESCALAR',
    escopo: 'CANDIDATO',
    formato: null,
    valores: { fonte: null, declarados: [] },
    resolucao: {
      origem: 'DECLARADO',
      pontoResolucao: 'INSCRICAO',
      binding: 'CAMPO_INSCRICAO:TRABALHA',
    },
    protecao: {
      classificacao: 'PESSOAL',
      finalidade: 'Classificar a reserva de vagas.',
      hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
      aprovacao: {
        situacao: 'APROVADA',
        ciclo: 0,
        solicitadaEm: null,
        decididaEm: null,
        classificacaoRecomendada: null,
        justificativa: null,
        aceitaEm: null,
        manifestadaEm: null,
        manifestacaoDesfavoravel: false,
        manifestacoesNoCiclo: 0,
      },
    },
  },
  semeadoPeloSistema: false,
  ativo: true,
  regrasPadrao: [],
};
