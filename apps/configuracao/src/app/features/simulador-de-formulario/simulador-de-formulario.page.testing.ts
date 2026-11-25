const SEMPRE = { tipo: 'SEMPRE', predicado: null };
const NUNCA = { tipo: 'NUNCA', predicado: null };
const regrasDoCampo = (obrigatoriedade: object, exibicao: unknown = null): object => ({
  exibicao,
  obrigatoriedade,
  restricoes: [],
  impedimento: null,
});

/** O formulário apresentado mínimo de um modelo: uma etapa com um campo. */
export const APRESENTACAO = {
  finalidade: 'INSCRICAO',
  titulo: null,
  etapas: [
    {
      codigo: 'DADOS',
      codigoNasRegras: 'DADOS',
      ordem: 0,
      tipo: 'SECAO',
      bloco: null,
      apresentacao: { titulo: 'Dados', descricao: null, aviso: null },
    },
  ],
  termos: [],
  coleta: {
    itens: [
      {
        fatoCodigo: 'NOME_SOCIAL',
        ordem: 0,
        etapaCodigo: 'DADOS',
        apresentacao: {
          rotulo: 'Nome social',
          tipoDeCampo: 'TEXTO',
          ajuda: null,
          pedirConfirmacao: false,
        },
        formato: null,
        valoresSelecionaveis: null,
      },
    ],
    grupos: [],
  },
  regras: {
    etapas: [
      {
        codigo: 'DADOS',
        exibicao: null,
        itens: [
          {
            fatoCodigo: 'NOME_SOCIAL',
            regras: regrasDoCampo(NUNCA),
            oferta: null,
            formato: null,
          },
        ],
        grupos: [],
      },
    ],
    termos: [],
    derivacoes: [],
    agregados: [],
  },
  pressupostos: { fatos: [], dataReferenciaFatos: null, fusoDoEnvio: null },
};

/** Um caso do corpus: regras e respostas, sem apresentação. */
export const CASO = {
  descricao: 'Endereço urbano esconde a aldeia.',
  regras: {
    etapas: [
      {
        codigo: 'DADOS',
        exibicao: null,
        itens: [
          {
            fatoCodigo: 'TIPO_ENDERECO',
            regras: regrasDoCampo(SEMPRE),
            oferta: ['ALDEIA', 'URBANO'],
            formato: null,
          },
          {
            fatoCodigo: 'NOME_ALDEIA',
            regras: regrasDoCampo(SEMPRE, [
              [{ fato: 'TIPO_ENDERECO', operador: 'IGUAL', valor: 'ALDEIA' }],
            ]),
            oferta: null,
            formato: null,
          },
        ],
        grupos: [],
      },
    ],
    termos: [],
    derivacoes: [],
    agregados: [],
  },
  respostas: { TIPO_ENDERECO: 'URBANO' },
  grupos: {},
  etapasConcluidas: [],
  pressupostos: {},
};
