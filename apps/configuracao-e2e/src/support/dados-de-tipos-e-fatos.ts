import { valorDaApi } from './valor-da-api';
import type {
  ClassificacaoDeProtecaoCodigo,
  ComponenteDeExibicaoCodigo,
  DecidirProtecaoDoCatalogoRequestDecisao,
  EscopoFatoCodigo,
  FatoCandidatoDto,
  HipoteseLegalTratamentoCodigo,
} from '@uniplus/shared-data/configuracao';
import type { JsonDaApi } from '@uniplus/shared-e2e';

/**
 * Os tipos de documento, os fatos do candidato e a proteção de dados deles nos testes visuais, com as
 * personas fictícias do portal.
 */
export const APROVADA = {
  situacao: 'APROVADA',
  ciclo: 1,
  solicitadaEm: null,
  decididaEm: null,
  classificacaoRecomendada: null,
  justificativa: null,
  aceitaEm: null,
  manifestadaEm: null,
  manifestacaoDesfavoravel: false,
  manifestacoesNoCiclo: 0,
};
export const AJUSTE = {
  ...APROVADA,
  situacao: 'AJUSTE_RECOMENDADO' satisfies `${DecidirProtecaoDoCatalogoRequestDecisao}`,
  classificacaoRecomendada: {
    codigo: 'SENSIVEL' as ClassificacaoDeProtecaoCodigo.SENSIVEL,
    rotulo: 'Sensível',
  },
  justificativa: 'O dado revela a identidade de gênero.',
};
export const PENDENTE = { ...APROVADA, situacao: 'PENDENTE' };
export const SOLICITADA = { ...APROVADA, situacao: 'SOLICITADA' };

export const PROTECAO = {
  classificacaoProtecao: {
    codigo: 'PESSOAL' as ClassificacaoDeProtecaoCodigo.PESSOAL,
    rotulo: 'Pessoal',
  },
  hipoteseLegal: {
    codigo:
      'EXECUCAO_POLITICAS_PUBLICAS' as HipoteseLegalTratamentoCodigo.EXECUCAO_POLITICAS_PUBLICAS,
    rotulo: 'Execução de políticas públicas',
  },
  finalidadeTratamento: 'Conferir o documento do candidato.',
};

export const CATEGORIAS = [
  { codigo: 'IDENTIFICACAO', nome: 'Identificação' },
  { codigo: 'SAUDE', nome: 'Saúde' },
].map((categoria, indice) => ({
  id: `01990000-0000-7000-0000-00000000000${indice + 1}`,
  ...categoria,
  descricao: null,
  ordem: indice + 1,
  criadoEm: '2026-08-30T12:00:00Z',
}));

export const TIPOS = [
  {
    id: '01960000-0000-7000-0000-0000000000d1',
    codigo: 'RG',
    nome: 'Registro Geral',
    descricao: 'Documento de identificação civil.',
    categoria: 'IDENTIFICACAO',
    formatosAceitos: 'pdf,jpg',
    tamanhoMaximoMb: 10,
    tipoEquivalente: 'CIN',
    criadoEm: '2026-06-10T12:00:00Z',
    protecaoAprovada: true,
    ...PROTECAO,
  },
  {
    id: '01960000-0000-7000-0000-0000000000d2',
    codigo: 'LAUDO_MEDICO',
    nome: 'Laudo médico complementar',
    descricao: null,
    categoria: 'SAUDE',
    formatosAceitos: 'pdf,jpg,png,tiff',
    tamanhoMaximoMb: null,
    tipoEquivalente: null,
    criadoEm: '2026-06-11T12:00:00Z',
    protecaoAprovada: false,
    ...PROTECAO,
    classificacaoProtecao: valorDaApi('INTERNO'),
  },
];

export const FATOS = [
  {
    id: '01960000-0000-7000-0000-0000000000f1',
    codigo: 'IDENTIDADE_GENERO',
    descritivo: {
      nome: 'Identidade de gênero',
      descricao: 'Como o candidato se identifica.',
      componenteExibicao: null,
    },
    definicao: {
      dominio: { codigo: 'OPCAO', rotulo: 'Opção' },
      cardinalidade: { codigo: 'VALOR_UNICO', rotulo: 'Valor único' },
      escopo: { codigo: 'CANDIDATO' as EscopoFatoCodigo.CANDIDATO, rotulo: 'Candidato' },
      formato: null,
      resolucao: {
        origem: { codigo: 'DECLARADO', rotulo: 'Declarado' },
        pontoResolucao: 'INSCRICAO',
        binding: 'CAMPO_INSCRICAO:IDENTIDADE_GENERO',
      },
      protecao: {
        classificacao: {
          codigo: 'SENSIVEL' as ClassificacaoDeProtecaoCodigo.SENSIVEL,
          rotulo: 'Sensível',
        },
        finalidade: PROTECAO.finalidadeTratamento,
        hipoteseLegal: PROTECAO.hipoteseLegal,
        aprovacao: AJUSTE,
      },
      valores: {
        fonte: { codigo: 'CATALOGO', rotulo: 'Catálogo' },
        declarados: [
          {
            codigo: 'MULHER_CIS',
            descricao: 'Mulher cis',
            ordem: 1,
            ativo: true,
            orientacao: 'Marque se a identidade coincide com o sexo de nascimento.',
          },
          {
            codigo: 'HOMEM_TRANS',
            descricao: 'Homem trans',
            ordem: 2,
            ativo: true,
            orientacao: null,
          },
        ],
      },
    },
    semeadoPeloSistema: false,
    ativo: true,
    regrasPadrao: [],
  },
  {
    id: '01960000-0000-7000-0000-0000000000f2',
    codigo: 'RENDA_FAMILIAR_BRUTA',
    descritivo: {
      nome: 'Renda familiar bruta',
      descricao: 'Soma da renda mensal bruta dos membros da família.',
      componenteExibicao: {
        codigo: 'MOEDA' as ComponenteDeExibicaoCodigo.MOEDA,
        rotulo: 'Valor em reais',
      },
    },
    definicao: {
      dominio: { codigo: 'NUMERICO', rotulo: 'Numérico' },
      cardinalidade: { codigo: 'VALOR_UNICO', rotulo: 'Valor único' },
      escopo: { codigo: 'CANDIDATO' as EscopoFatoCodigo.CANDIDATO, rotulo: 'Candidato' },
      formato: null,
      resolucao: {
        origem: { codigo: 'DECLARADO', rotulo: 'Declarado' },
        pontoResolucao: 'INSCRICAO',
        binding: 'CAMPO_INSCRICAO:RENDA',
      },
      protecao: {
        classificacao: PROTECAO.classificacaoProtecao,
        finalidade: PROTECAO.finalidadeTratamento,
        hipoteseLegal: PROTECAO.hipoteseLegal,
        aprovacao: SOLICITADA,
      },
      valores: { fonte: null, declarados: [] },
    },
    semeadoPeloSistema: false,
    ativo: true,
    regrasPadrao: [],
  },
] satisfies JsonDaApi<FatoCandidatoDto>[];

export const PENDENCIAS = [
  {
    tipo: 'TIPO_DOCUMENTO',
    id: TIPOS[1].id,
    codigo: TIPOS[1].codigo,
    nome: TIPOS[1].nome,
    ...PROTECAO,
    classificacaoProtecao: valorDaApi('INTERNO'),
    aprovacao: PENDENTE,
  },
  {
    tipo: 'DADO_DO_CANDIDATO',
    id: FATOS[1].id,
    codigo: FATOS[1].codigo,
    nome: FATOS[1].descritivo.nome,
    ...PROTECAO,
    aprovacao: PENDENTE,
  },
];

export const SOLICITADOS = PENDENCIAS.map((item) => ({ ...item, aprovacao: SOLICITADA }));

export const ATO = {
  classificacaoRecomendada: null,
  justificativa: null,
  ciclo: 1,
  dianteDeManifestacaoDesfavoravel: false,
  ...PROTECAO,
};

/** Os atos de cada item, em ordem cronológica, com as personas fictícias do portal. */
export const ATOS_DO_TIPO = [
  {
    ato: 'SOLICITACAO',
    instante: '2026-10-29T15:00:00Z',
    atorNome: 'Isabella Priscila Figueiredo',
    ...ATO,
    classificacaoProtecao: valorDaApi('INTERNO'),
  },
  {
    ato: 'AJUSTE_RECOMENDADO' satisfies `${DecidirProtecaoDoCatalogoRequestDecisao}`,
    instante: '2026-10-30T13:30:00Z',
    atorNome: 'Caroline Stefany Jesus',
    ...ATO,
    classificacaoProtecao: valorDaApi('INTERNO'),
    classificacaoRecomendada: valorDaApi('PESSOAL'),
    justificativa: 'O laudo identifica o candidato e traz dado de saúde.',
  },
  {
    ato: 'ACEITE',
    instante: '2026-10-31T10:15:00Z',
    atorNome: 'Isabella Priscila Figueiredo',
    ...ATO,
    classificacaoProtecao: valorDaApi('PESSOAL'),
  },
];

export const ATOS_DO_FATO = [
  {
    ato: 'SOLICITACAO',
    instante: '2026-10-28T14:00:00Z',
    atorNome: 'Isabella Priscila Figueiredo',
    ...ATO,
  },
  {
    ato: 'DEVOLUCAO' satisfies `${DecidirProtecaoDoCatalogoRequestDecisao}`,
    instante: '2026-10-29T09:20:00Z',
    atorNome: 'Betina Marina Valentina das Neves',
    ...ATO,
    justificativa:
      'A renda familiar bruta é dado pessoal que exige a finalidade declarada com mais precisão.',
  },
  {
    ato: 'SOLICITACAO',
    instante: '2026-10-30T16:45:00Z',
    atorNome: 'Isabella Priscila Figueiredo',
    ...ATO,
  },
];

export const DECISOES = [
  {
    cadastro: 'DADO_DO_CANDIDATO',
    itemId: FATOS[1].id,
    itemCodigo: FATOS[1].codigo,
    itemNome: FATOS[1].descritivo.nome,
    ...ATOS_DO_FATO[1],
  },
  {
    cadastro: 'TIPO_DOCUMENTO',
    itemId: TIPOS[1].id,
    itemCodigo: TIPOS[1].codigo,
    itemNome: TIPOS[1].nome,
    ...ATOS_DO_TIPO[1],
  },
  {
    cadastro: 'DADO_DO_CANDIDATO',
    itemId: FATOS[0].id,
    itemCodigo: FATOS[0].codigo,
    itemNome: FATOS[0].descritivo.nome,
    ato: 'APROVACAO' satisfies `${DecidirProtecaoDoCatalogoRequestDecisao}`,
    instante: '2026-10-27T11:00:00Z',
    atorNome: 'Caroline Stefany Jesus',
    ...ATO,
    classificacaoProtecao: valorDaApi('SENSIVEL'),
  },
];
