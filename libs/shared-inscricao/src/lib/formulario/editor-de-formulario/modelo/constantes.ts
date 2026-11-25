import {
  ApresentacaoDaPagina,
  ApresentacaoDoCampo,
  ConteudoDoFormulario,
  PaginaDoFormulario,
  ExibicaoEObrigatoriedade,
  Obrigatoriedade,
  OpcaoDoFormulario,
} from './tipos';

export const TIPO_SECAO = 'SECAO';
export const TIPO_BLOCO = 'BLOCO';
export const OBRIGATORIEDADE_SEMPRE = 'SEMPRE';
export const OBRIGATORIEDADE_NUNCA = 'NUNCA';
export const OBRIGATORIEDADE_QUANDO = 'QUANDO';

/** A seção dos dados básicos da inscrição: a API a acrescenta e não deixa alterá-la. */
export const SECAO_DADOS_BASICOS = 'DADOS_BASICOS';
export const BLOCO_REVISAO_E_ACEITE = 'REVISAO_E_ACEITE';
export const BLOCO_COMPROVACAO_DOCUMENTAL = 'COMPROVACAO_DOCUMENTAL';
export const BLOCO_MODALIDADES_CALCULADAS = 'MODALIDADES_CALCULADAS';

/** A obrigatoriedade com que o campo, o grupo ou o termo nasce: sempre, sem condição. */
export const OBRIGATORIEDADE_INICIAL: Obrigatoriedade = {
  tipo: OBRIGATORIEDADE_SEMPRE,
  predicado: null,
};

/** As regras com que o campo, o grupo ou o termo nasce: aparece sempre e é obrigatório. */
export const REGRAS_INICIAIS: ExibicaoEObrigatoriedade = {
  exibicao: null,
  obrigatoriedade: OBRIGATORIEDADE_INICIAL,
};

/** A apresentação da página nova: só o título, sem descrição nem aviso. */
export function apresentacaoDaPagina(titulo: string): ApresentacaoDaPagina {
  return { titulo, descricao: null, aviso: null };
}

/** A apresentação do campo novo: sem ajuda e sem pedido de confirmação. */
export function apresentacaoDoCampo(rotulo: string, tipoDeCampo: string): ApresentacaoDoCampo {
  return { rotulo, tipoDeCampo, ajuda: null, pedirConfirmacao: false };
}

/** A página nova, sem itens: seção quando não há bloco, ou o bloco do sistema dado. */
export function paginaNova(
  codigo: string,
  titulo: string,
  bloco: string | null = null,
): PaginaDoFormulario {
  return {
    codigo,
    ordem: 0,
    tipo: bloco === null ? TIPO_SECAO : TIPO_BLOCO,
    bloco,
    apresentacao: apresentacaoDaPagina(titulo),
    exibicao: null,
  };
}

export const FINALIDADE_INSCRICAO = 'INSCRICAO';

/** Os tetos da API (`FormaDoItem`, `FormaDaPagina`): os dados básicos contam no total de itens. */
export const LIMITES_DO_FORMULARIO = {
  itens: 200,
  rotulo: 300,
  ajuda: 1000,
  tituloDaPagina: 300,
  textoDaPagina: 2000,
  tituloDoFormulario: 300,
} as const;

/** Como o candidato responde, pelo tipo de campo. */
export const TIPOS_DE_CAMPO: Readonly<Record<string, string>> = {
  SIM_OU_NAO: 'Sim ou não',
  NUMERO: 'Número',
  TEXTO: 'Texto',
  DATA: 'Data',
  ENDERECO: 'Endereço',
  MUNICIPIO: 'Município',
  ESCOLHA_UNICA: 'Escolha de um valor',
  ESCOLHA_MULTIPLA: 'Escolha de vários valores',
};

export const FINALIDADES: readonly OpcaoDoFormulario[] = [
  { valor: FINALIDADE_INSCRICAO, rotulo: 'Inscrição' },
  { valor: 'ISENCAO_TAXA', rotulo: 'Isenção da taxa de inscrição' },
  { valor: 'HABILITACAO', rotulo: 'Habilitação' },
];

export const OBRIGATORIEDADES: readonly OpcaoDoFormulario[] = [
  { valor: OBRIGATORIEDADE_SEMPRE, rotulo: 'Obrigatório' },
  { valor: OBRIGATORIEDADE_NUNCA, rotulo: 'Opcional' },
  { valor: OBRIGATORIEDADE_QUANDO, rotulo: 'Obrigatório conforme respostas anteriores' },
];

export const BLOCOS: readonly OpcaoDoFormulario[] = [
  { valor: BLOCO_COMPROVACAO_DOCUMENTAL, rotulo: 'Comprovação documental' },
  { valor: BLOCO_MODALIDADES_CALCULADAS, rotulo: 'Modalidades calculadas' },
  { valor: BLOCO_REVISAO_E_ACEITE, rotulo: 'Revisão e aceite' },
];

/** Os blocos que a finalidade admite: as modalidades calculadas só fazem sentido na inscrição. */
export function blocosAdmitidos(finalidade: string): readonly OpcaoDoFormulario[] {
  return BLOCOS.filter(
    (bloco) => bloco.valor !== BLOCO_MODALIDADES_CALCULADAS || finalidade === FINALIDADE_INSCRICAO,
  );
}

/**
 * O conteúdo com que um formulário nasce: só a revisão e aceite, que toda finalidade exige como
 * última página. Na inscrição, a API acrescenta a seção dos dados básicos.
 */
export function conteudoInicial(): ConteudoDoFormulario<number> {
  return {
    titulo: null,
    paginas: [paginaNova(BLOCO_REVISAO_E_ACEITE, 'Revisão e aceite', BLOCO_REVISAO_E_ACEITE)],
    itens: [],
    termos: [],
    pressupostos: [],
    grupos: [],
  };
}
