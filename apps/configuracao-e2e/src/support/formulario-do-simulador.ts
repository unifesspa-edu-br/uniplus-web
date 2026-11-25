const SEMPRE = { tipo: 'SEMPRE', predicado: null };

const CONDICAO_DA_ALDEIA = { fato: 'TIPO_ENDERECO', operador: 'IGUAL', valor: 'ALDEIA' };

const OCORRENCIAS_DA_COMPOSICAO = { minimo: 1, maximo: 3, incluiCandidato: false };

type Condicao = Record<string, unknown>;

function apresentacaoDoCampo(rotulo: string, tipoDeCampo: string, ajuda: string | null = null) {
  return { rotulo, tipoDeCampo, ajuda, pedirConfirmacao: false };
}

function secao(codigo: string, ordem: number, titulo: string, descricao: string | null) {
  return {
    codigo,
    codigoNasRegras: codigo,
    ordem,
    tipo: 'SECAO',
    bloco: null,
    apresentacao: { titulo, descricao, aviso: null },
  };
}

const ITENS_DA_COLETA = [
  {
    fatoCodigo: 'TIPO_ENDERECO',
    ordem: 0,
    apresentacao: apresentacaoDoCampo('Tipo de endereço', 'ESCOLHA_UNICA'),
    valoresSelecionaveis: [
      { codigo: 'URBANO', descricao: 'Urbano', ordem: 0 },
      { codigo: 'ALDEIA', descricao: 'Aldeia indígena', ordem: 1 },
    ],
  },
  {
    fatoCodigo: 'NOME_ALDEIA',
    ordem: 1,
    apresentacao: apresentacaoDoCampo('Nome da aldeia', 'TEXTO', 'Como a comunidade é conhecida.'),
  },
];

const GRUPOS_DA_COLETA = [
  {
    codigo: 'COMPOSICAO',
    ordem: 0,
    rotulo: 'Integrante',
    ocorrencias: OCORRENCIAS_DA_COMPOSICAO,
    subitens: [
      {
        fatoCodigo: 'RENDA',
        ordem: 0,
        apresentacao: apresentacaoDoCampo('Renda mensal', 'NUMERO'),
      },
    ],
  },
];

function etapaDoEndereco(condicaoDaAldeia: Condicao) {
  const regrasDoItem = { obrigatoriedade: SEMPRE, restricoes: [] };
  return {
    codigo: 'ENDERECO',
    exibicao: null,
    itens: [
      { fatoCodigo: 'TIPO_ENDERECO', oferta: ['ALDEIA', 'URBANO'], regras: regrasDoItem },
      {
        fatoCodigo: 'NOME_ALDEIA',
        regras: { ...regrasDoItem, exibicao: [[condicaoDaAldeia]] },
      },
    ],
    grupos: [],
  };
}

const RENDA_DA_COMPOSICAO = {
  fatoCodigo: 'RENDA',
  regras: { obrigatoriedade: SEMPRE, restricoes: [{ tipo: 'FAIXA_NUMERICA', minimo: 0 }] },
};

const GRUPO_DA_COMPOSICAO = {
  codigo: 'COMPOSICAO',
  ocorrencias: OCORRENCIAS_DA_COMPOSICAO,
  regras: { obrigatoriedade: SEMPRE },
  subitens: [RENDA_DA_COMPOSICAO],
};

const ETAPA_DA_FAMILIA = {
  codigo: 'FAMILIA',
  exibicao: null,
  itens: [],
  grupos: [GRUPO_DA_COMPOSICAO],
};

const SECOES = [
  secao('ENDERECO', 0, 'Endereço', 'Onde você mora.'),
  secao('FAMILIA', 1, 'Composição familiar', null),
];

const SEM_TERMOS_NEM_DERIVACOES = { termos: [], derivacoes: [], agregados: [] };

/**
 * O formulário exportado que o simulador abre, na forma do formulário renderizável: apresentação em
 * `etapas`, o que se pergunta em `coleta`, as regras em `regras` e os fatos de fora em `pressupostos`.
 * A condição de exibição do campo da aldeia é a que o caso quer exercitar; o operador fora do
 * vocabulário só cabe por extenso, porque o tipo gerado não o admitiria.
 */
export function formularioDoSimulador(condicaoDaAldeia: Condicao = CONDICAO_DA_ALDEIA) {
  return {
    finalidade: 'INSCRICAO',
    titulo: 'Inscrição',
    etapas: SECOES,
    termos: [],
    coleta: { itens: ITENS_DA_COLETA, grupos: GRUPOS_DA_COLETA },
    regras: {
      etapas: [etapaDoEndereco(condicaoDaAldeia), ETAPA_DA_FAMILIA],
      ...SEM_TERMOS_NEM_DERIVACOES,
    },
    pressupostos: { fatos: [] },
  };
}
