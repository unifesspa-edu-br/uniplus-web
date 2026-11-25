import type { CepEncontrado } from '../endereco-geo/endereco-geo.model';

import type {
  ApresentacaoDaEtapa,
  ApresentacaoDoCampo,
} from '../editor-de-formulario/modelo/tipos';

import type { CampoApresentado, FormularioDoCandidato } from './formulario-do-candidato.model';
import type {
  GrupoDasRegras,
  ItemDasRegras,
  RegrasDoItemDasRegras,
} from './interpretador/regras-do-formulario';

export const CODIGO_DA_SECAO_DE_DADOS = 'Inscricao:DADOS';

type OutrosDoItem = Partial<Pick<ItemDasRegras, 'oferta' | 'formato'>> &
  Partial<RegrasDoItemDasRegras>;

/** O campo das regras: sempre obrigatório e sem restrição, salvo o que `outros` disser. */
export const itemDasRegras = (fatoCodigo: string, outros: OutrosDoItem = {}): ItemDasRegras => {
  const { oferta, formato, ...regras } = outros;
  return {
    fatoCodigo,
    regras: { obrigatoriedade: { tipo: 'SEMPRE' }, restricoes: [], ...regras },
    oferta,
    formato,
  };
};

/** O grupo das regras: de um a dois integrantes, obrigatório, salvo o que `outros` disser. */
export const grupoDasRegras = (
  codigo: string,
  subitens: ItemDasRegras[],
  outros: Partial<GrupoDasRegras> = {},
): GrupoDasRegras => ({
  codigo,
  ocorrencias: { minimo: 1, maximo: 2, incluiCandidato: false },
  regras: { obrigatoriedade: { tipo: 'SEMPRE' } },
  subitens,
  ...outros,
});

type OutrosDoCampo = Partial<Omit<CampoApresentado, 'apresentacao'>> &
  Partial<Pick<ApresentacaoDoCampo, 'ajuda' | 'pedirConfirmacao'>>;

export const campoApresentado = (
  fatoCodigo: string,
  rotulo: string,
  tipoDeCampo: string,
  { ajuda, pedirConfirmacao = false, ...outros }: OutrosDoCampo = {},
): CampoApresentado => ({
  fatoCodigo,
  ordem: 0,
  apresentacao: { rotulo, tipoDeCampo, ajuda, pedirConfirmacao },
  ...outros,
});

export const apresentacaoDaEtapa = (titulo: string): ApresentacaoDaEtapa => ({
  titulo,
  descricao: null,
  aviso: null,
});

export const FORMULARIO_DE_ENDERECO_COM_ALDEIA: FormularioDoCandidato = {
  finalidade: 'INSCRICAO',
  etapas: [
    {
      codigo: 'DADOS',
      codigoNasRegras: CODIGO_DA_SECAO_DE_DADOS,
      ordem: 0,
      tipo: 'SECAO',
      apresentacao: apresentacaoDaEtapa('Dados'),
    },
  ],
  termos: [],
  coleta: {
    itens: [
      campoApresentado('TIPO_ENDERECO', 'Tipo de endereço', 'ESCOLHA_UNICA', {
        valoresSelecionaveis: [
          { codigo: 'URBANO', descricao: 'Urbano', ordem: 0 },
          { codigo: 'ALDEIA', descricao: 'Aldeia', ordem: 1 },
        ],
      }),
      campoApresentado('NOME_ALDEIA', 'Nome da aldeia', 'TEXTO', { ordem: 1 }),
    ],
    grupos: [],
  },
  pressupostos: { fatos: [] },
  regras: {
    etapas: [
      {
        codigo: CODIGO_DA_SECAO_DE_DADOS,
        itens: [
          itemDasRegras('TIPO_ENDERECO', { oferta: ['ALDEIA', 'URBANO'] }),
          itemDasRegras('NOME_ALDEIA', {
            exibicao: [[{ fato: 'TIPO_ENDERECO', operador: 'IGUAL', valor: 'ALDEIA' }]],
          }),
        ],
      },
    ],
  },
};

export const MUNICIPIO_DE_MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };
export const CEP_DE_MARABA: CepEncontrado = {
  cep: '68507590',
  tipo: 'Rua',
  logradouro: 'Folha 31',
  complemento: null,
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: 'Marabá',
  codigoIbge: '1504208',
  uf: 'PA',
  latitude: null,
  longitude: null,
  nivelResolucao: 'logradouro',
  origem: 'logradouro',
};
export const FORMULARIO_DE_ENDERECO_RESIDENCIAL: FormularioDoCandidato = {
  ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  coleta: {
    itens: [campoApresentado('ENDERECO_RESIDENCIAL', 'Endereço residencial', 'ENDERECO')],
    grupos: [],
  },
  regras: {
    etapas: [{ codigo: CODIGO_DA_SECAO_DE_DADOS, itens: [itemDasRegras('ENDERECO_RESIDENCIAL')] }],
  },
};

export const FORMULARIO_COM_TERMO_DE_VERACIDADE: FormularioDoCandidato = {
  ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  coleta: { itens: [], grupos: [] },
  etapas: [
    {
      codigo: 'REVISAO',
      codigoNasRegras: null,
      ordem: 0,
      tipo: 'BLOCO',
      bloco: 'REVISAO_E_ACEITE',
      apresentacao: apresentacaoDaEtapa('Revisão e aceite'),
    },
  ],
  termos: [
    {
      codigo: 'VERACIDADE',
      codigoNasRegras: 'Inscricao:VERACIDADE',
      ordem: 0,
      conteudo: { nome: 'Veracidade', texto: 'Declaro.', baseLegal: 'Lei' },
    },
  ],
  regras: {
    etapas: [],
    termos: [{ codigo: 'Inscricao:VERACIDADE', regras: { obrigatoriedade: { tipo: 'SEMPRE' } } }],
  },
};

export const FORMULARIO_DE_DUAS_SECOES: FormularioDoCandidato = {
  finalidade: 'INSCRICAO',
  etapas: [
    {
      codigo: 'CONTATO',
      codigoNasRegras: 'Inscricao:CONTATO',
      ordem: 0,
      tipo: 'SECAO',
      apresentacao: apresentacaoDaEtapa('Contato'),
    },
    {
      codigo: 'NOME',
      codigoNasRegras: 'Inscricao:NOME',
      ordem: 1,
      tipo: 'SECAO',
      apresentacao: apresentacaoDaEtapa('Nome'),
    },
  ],
  termos: [],
  coleta: {
    itens: [
      campoApresentado('EMAIL', 'E-mail', 'TEXTO'),
      campoApresentado('NOME_SOCIAL', 'Nome social', 'TEXTO', { ordem: 1 }),
    ],
    grupos: [],
  },
  pressupostos: { fatos: [] },
  regras: {
    etapas: [
      { codigo: 'Inscricao:CONTATO', itens: [itemDasRegras('EMAIL')] },
      { codigo: 'Inscricao:NOME', itens: [itemDasRegras('NOME_SOCIAL')] },
    ],
  },
};

export const FORMULARIO_COM_GRUPO_DA_FAMILIA: FormularioDoCandidato = {
  ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  coleta: {
    itens: [],
    grupos: [
      {
        codigo: 'FAMILIA',
        ordem: 0,
        rotulo: 'Integrante',
        ocorrencias: { minimo: 1, maximo: 2, incluiCandidato: false },
        subitens: [campoApresentado('RENDA', 'Renda', 'NUMERO')],
      },
    ],
  },
  regras: {
    etapas: [
      {
        codigo: CODIGO_DA_SECAO_DE_DADOS,
        grupos: [grupoDasRegras('FAMILIA', [itemDasRegras('RENDA')])],
      },
    ],
  },
};

export const FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS: FormularioDoCandidato = {
  ...FORMULARIO_COM_GRUPO_DA_FAMILIA,
  coleta: {
    itens: [],
    grupos: [
      {
        ...FORMULARIO_COM_GRUPO_DA_FAMILIA.coleta.grupos[0],
        subitens: [
          campoApresentado('RENDA', 'Renda', 'NUMERO'),
          campoApresentado('PROFISSAO', 'Profissão', 'TEXTO'),
        ],
      },
    ],
  },
  regras: {
    etapas: [
      {
        codigo: CODIGO_DA_SECAO_DE_DADOS,
        grupos: [grupoDasRegras('FAMILIA', [itemDasRegras('RENDA'), itemDasRegras('PROFISSAO')])],
      },
    ],
  },
};

export const FORMULARIO_COM_CONFIRMACAO_DO_EMAIL: FormularioDoCandidato = {
  ...FORMULARIO_DE_DUAS_SECOES,
  coleta: {
    itens: [campoApresentado('EMAIL', 'E-mail', 'TEXTO', { pedirConfirmacao: true })],
    grupos: [],
  },
  regras: { etapas: [{ codigo: 'Inscricao:CONTATO', itens: [itemDasRegras('EMAIL')] }] },
};

export const FORMULARIO_DA_FAMILIA_COM_CONFIRMACAO: FormularioDoCandidato = {
  ...FORMULARIO_COM_GRUPO_DA_FAMILIA,
  coleta: {
    itens: [],
    grupos: [
      {
        ...FORMULARIO_COM_GRUPO_DA_FAMILIA.coleta.grupos[0],
        subitens: [campoApresentado('EMAIL', 'E-mail', 'TEXTO', { pedirConfirmacao: true })],
      },
    ],
  },
  regras: {
    etapas: [
      {
        codigo: CODIGO_DA_SECAO_DE_DADOS,
        grupos: [grupoDasRegras('FAMILIA', [itemDasRegras('EMAIL')])],
      },
    ],
  },
};

export const FORMULARIO_COM_TELEFONE: FormularioDoCandidato = {
  ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  coleta: {
    itens: [campoApresentado('TELEFONE', 'Telefone', 'TEXTO', { formato: 'TELEFONE' })],
    grupos: [],
  },
  regras: { etapas: [{ codigo: CODIGO_DA_SECAO_DE_DADOS, itens: [itemDasRegras('TELEFONE')] }] },
};
