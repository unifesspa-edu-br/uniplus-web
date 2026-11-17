import type { CepEncontrado } from '../endereco-geo/endereco-geo.model';

import type { CampoRenderizavel, FormularioDoCandidato } from './formulario-do-candidato.model';
import type { ItemDasRegras } from './interpretador/regras-do-formulario';

export const CODIGO_DA_SECAO_DE_DADOS = 'Inscricao:DADOS';

export const itemDasRegras = (
  fatoCodigo: string,
  outros: Partial<ItemDasRegras> = {},
): ItemDasRegras => ({
  fatoCodigo,
  obrigatoriedade: 'SEMPRE',
  restricoes: [],
  ...outros,
});

export const campoRenderizavel = (
  fatoCodigo: string,
  rotulo: string,
  tipoRenderizacao: string,
  outros: Partial<CampoRenderizavel> = {},
): CampoRenderizavel => ({
  fatoCodigo,
  ordem: 0,
  rotulo,
  tipoRenderizacao,
  ...outros,
});

export const FORMULARIO_DE_ENDERECO_COM_ALDEIA: FormularioDoCandidato = {
  finalidade: 'INSCRICAO',
  etapas: [
    {
      codigo: 'DADOS',
      codigoNasRegras: CODIGO_DA_SECAO_DE_DADOS,
      ordem: 0,
      tipo: 'SECAO',
      titulo: 'Dados',
    },
  ],
  termos: [],
  grupos: [],
  fatosColetados: [
    campoRenderizavel('TIPO_ENDERECO', 'Tipo de endereço', 'SELECAO_UNICA', {
      valoresSelecionaveis: [
        { codigo: 'URBANO', descricao: 'Urbano', ordem: 0 },
        { codigo: 'ALDEIA', descricao: 'Aldeia', ordem: 1 },
      ],
    }),
    campoRenderizavel('NOME_ALDEIA', 'Nome da aldeia', 'TEXTO', { ordem: 1 }),
  ],
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
  fatosColetados: [campoRenderizavel('ENDERECO_RESIDENCIAL', 'Endereço residencial', 'ENDERECO')],
  regras: {
    etapas: [{ codigo: CODIGO_DA_SECAO_DE_DADOS, itens: [itemDasRegras('ENDERECO_RESIDENCIAL')] }],
  },
};

export const FORMULARIO_COM_TERMO_DE_VERACIDADE: FormularioDoCandidato = {
  ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  fatosColetados: [],
  etapas: [
    {
      codigo: 'REVISAO',
      codigoNasRegras: null,
      ordem: 0,
      tipo: 'BLOCO',
      bloco: 'REVISAO_E_ACEITE',
      titulo: 'Revisão e aceite',
    },
  ],
  termos: [
    {
      codigo: 'VERACIDADE',
      codigoNasRegras: 'Inscricao:VERACIDADE',
      ordem: 0,
      nome: 'Veracidade',
      texto: 'Declaro.',
      baseLegal: 'Lei',
    },
  ],
  regras: {
    etapas: [],
    termos: [{ codigo: 'Inscricao:VERACIDADE', obrigatoriedade: 'SEMPRE' }],
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
      titulo: 'Contato',
    },
    { codigo: 'NOME', codigoNasRegras: 'Inscricao:NOME', ordem: 1, tipo: 'SECAO', titulo: 'Nome' },
  ],
  termos: [],
  grupos: [],
  fatosColetados: [
    campoRenderizavel('EMAIL', 'E-mail', 'TEXTO'),
    campoRenderizavel('NOME_SOCIAL', 'Nome social', 'TEXTO', { ordem: 1 }),
  ],
  regras: {
    etapas: [
      { codigo: 'Inscricao:CONTATO', itens: [itemDasRegras('EMAIL')] },
      { codigo: 'Inscricao:NOME', itens: [itemDasRegras('NOME_SOCIAL')] },
    ],
  },
};

export const FORMULARIO_COM_GRUPO_DA_FAMILIA: FormularioDoCandidato = {
  ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  fatosColetados: [],
  grupos: [
    {
      codigo: 'FAMILIA',
      ordem: 0,
      rotulo: 'Integrante',
      minimo: 1,
      maximo: 2,
      incluiCandidato: false,
      subitens: [campoRenderizavel('RENDA', 'Renda', 'NUMERO')],
    },
  ],
  regras: {
    etapas: [
      {
        codigo: CODIGO_DA_SECAO_DE_DADOS,
        grupos: [
          {
            codigo: 'FAMILIA',
            obrigatoriedade: 'SEMPRE',
            minimo: 1,
            maximo: 2,
            incluiCandidato: false,
            subitens: [itemDasRegras('RENDA')],
          },
        ],
      },
    ],
  },
};

export const FORMULARIO_DA_FAMILIA_COM_DOIS_SUBCAMPOS: FormularioDoCandidato = {
  ...FORMULARIO_COM_GRUPO_DA_FAMILIA,
  grupos: [
    {
      ...FORMULARIO_COM_GRUPO_DA_FAMILIA.grupos[0],
      subitens: [
        campoRenderizavel('RENDA', 'Renda', 'NUMERO'),
        campoRenderizavel('PROFISSAO', 'Profissão', 'TEXTO'),
      ],
    },
  ],
  regras: {
    etapas: [
      {
        codigo: CODIGO_DA_SECAO_DE_DADOS,
        grupos: [
          {
            codigo: 'FAMILIA',
            obrigatoriedade: 'SEMPRE',
            minimo: 1,
            maximo: 2,
            incluiCandidato: false,
            subitens: [itemDasRegras('RENDA'), itemDasRegras('PROFISSAO')],
          },
        ],
      },
    ],
  },
};

export const FORMULARIO_COM_CONFIRMACAO_DO_EMAIL: FormularioDoCandidato = {
  ...FORMULARIO_DE_DUAS_SECOES,
  fatosColetados: [campoRenderizavel('EMAIL', 'E-mail', 'TEXTO', { pedirConfirmacao: true })],
  regras: { etapas: [{ codigo: 'Inscricao:CONTATO', itens: [itemDasRegras('EMAIL')] }] },
};

export const FORMULARIO_DA_FAMILIA_COM_CONFIRMACAO: FormularioDoCandidato = {
  ...FORMULARIO_COM_GRUPO_DA_FAMILIA,
  grupos: [
    {
      ...FORMULARIO_COM_GRUPO_DA_FAMILIA.grupos[0],
      subitens: [campoRenderizavel('EMAIL', 'E-mail', 'TEXTO', { pedirConfirmacao: true })],
    },
  ],
  regras: {
    etapas: [
      {
        codigo: CODIGO_DA_SECAO_DE_DADOS,
        grupos: [
          {
            codigo: 'FAMILIA',
            obrigatoriedade: 'SEMPRE',
            minimo: 1,
            maximo: 2,
            incluiCandidato: false,
            subitens: [itemDasRegras('EMAIL')],
          },
        ],
      },
    ],
  },
};

export const FORMULARIO_COM_TELEFONE: FormularioDoCandidato = {
  ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  fatosColetados: [campoRenderizavel('TELEFONE', 'Telefone', 'TEXTO', { formato: 'TELEFONE' })],
  regras: { etapas: [{ codigo: CODIGO_DA_SECAO_DE_DADOS, itens: [itemDasRegras('TELEFONE')] }] },
};
