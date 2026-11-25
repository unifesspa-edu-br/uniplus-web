import {
  DADO_SIM_OU_NAO,
  ORIGEM_DECLARADA,
  VALOR_UNICO,
} from '../../shared/valores-do-catalogo.testing';
import {
  FinalidadeFormularioCodigo as FinalidadeDoModelo,
  OperadorCodigo as OperadorDoCatalogo,
  type FatoDoCatalogoDto,
  type ModeloFormularioView,
} from '@uniplus/shared-data/configuracao';
import {
  type FormularioDto,
  BlocoSistemaCodigo,
  TipoEtapaFormularioCodigo,
  TipoObrigatoriedadeCodigo,
  FinalidadeFormularioCodigo,
  OperadorCodigo,
  TipoDeCampoCodigo,
} from '@uniplus/shared-data/selecao';

import type { AtributosCongeladosDaFase, FaseDoCronograma } from '../../processo-seletivo.models';

export const BASE = 'http://localhost:5000';
export const PROCESSO_ID = '01960000-0000-7000-0000-0000000007aa';
export const ROTA_PROCESSO = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}`;
const ROTA_FORMULARIOS = `${BASE}/api/selecao/admin/processos-seletivos/${PROCESSO_ID}/formularios`;
export const ROTA_INSCRICAO = `${ROTA_FORMULARIOS}/INSCRICAO`;
export const ROTA_HABILITACAO = `${ROTA_FORMULARIOS}/HABILITACAO`;
export const ROTA_APLICACAO = `${ROTA_FORMULARIOS}/aplicacoes-de-modelo`;
export const ROTA_MODELOS = `${BASE}/api/configuracao/admin/modelos-formulario`;
export const PROBLEM_JSON = { 'content-type': 'application/problem+json' };

type ItemDoFormulario = FormularioDto['coleta']['itens'][number];
type EtapaDoFormulario = FormularioDto['etapas'][number];

export const CONGELADOS_DA_INSCRICAO: AtributosCongeladosDaFase = {
  origemData: 'NO_EDITAL',
  agrupaEtapas: false,
  coletaInscricao: true,
  permiteComplementacao: false,
  coletaSolicitacaoIsencao: false,
};

export const FASE_INSCRICAO: FaseDoCronograma = {
  faseCanonicaId: 'fc-inscricao',
  codigo: 'INSCRICAO',
  ordem: 0,
  inicio: null,
  fim: null,
  unidadeResponsavelId: null,
  produtos: [],
  noMesmoMomentoDaAnterior: false,
  emiteParecerIndividual: false,
  bancasRequeridas: [],
  regraRecurso: null,
  congelados: CONGELADOS_DA_INSCRICAO,
};

export const FASE_HABILITACAO: FaseDoCronograma = {
  ...FASE_INSCRICAO,
  faseCanonicaId: 'fc-habilitacao',
  codigo: 'HABILITACAO',
  ordem: 1,
  congelados: { ...CONGELADOS_DA_INSCRICAO, coletaInscricao: false },
};

const APRESENTACAO_BOOLEANA: Omit<ItemDoFormulario['apresentacao'], 'rotulo'> = {
  tipoDeCampo: TipoDeCampoCodigo.SIM_OU_NAO,
  ajuda: null,
  pedirConfirmacao: false,
};

const REGRAS_SEMPRE_OBRIGATORIO: ItemDoFormulario['regras'] = {
  exibicao: null,
  obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null },
  restricoes: [],
  impedimento: null,
};

export const campo = (
  fatoCodigo: string,
  ordem: number,
  etapaCodigo: string,
): ItemDoFormulario => ({
  fatoCodigo,
  ordem,
  etapaCodigo,
  apresentacao: { ...APRESENTACAO_BOOLEANA, rotulo: fatoCodigo },
  regras: REGRAS_SEMPRE_OBRIGATORIO,
  opcoes: null,
  formato: null,
});

const tituloDaEtapa = (codigo: string): string =>
  codigo === 'S1' ? 'Condições especiais' : codigo;

export const etapa = (
  codigo: string,
  ordem: number,
  bloco: BlocoSistemaCodigo | null = null,
): EtapaDoFormulario => ({
  codigo,
  ordem,
  tipo: bloco === null ? TipoEtapaFormularioCodigo.SECAO : TipoEtapaFormularioCodigo.BLOCO,
  bloco,
  apresentacao: { titulo: tituloDaEtapa(codigo), descricao: null, aviso: null },
  exibicao: null,
});

/** A inscrição como o servidor a devolve: com a seção dos dados básicos que a API acrescenta. */
export const GRAVADO: FormularioDto = {
  finalidade: { codigo: FinalidadeFormularioCodigo.INSCRICAO, rotulo: 'Inscrição' },
  faseId: 'F-INSCRICAO',
  titulo: 'Inscrição — Medicina 2027',
  modeloOrigem: null,
  etapas: [
    etapa('DADOS_BASICOS', 0),
    etapa('S1', 1),
    etapa('REVISAO_E_ACEITE', 2, BlocoSistemaCodigo.REVISAO_E_ACEITE),
  ],
  coleta: {
    itens: [
      campo('NOME', 0, 'DADOS_BASICOS'),
      {
        ...campo('PCD', 1, 'S1'),
        regras: {
          ...REGRAS_SEMPRE_OBRIGATORIO,
          obrigatoriedade: {
            tipo: TipoObrigatoriedadeCodigo.QUANDO,
            predicado: [[{ fato: 'NOME', operador: OperadorCodigo.IGUAL, valor: 'x' }]],
          },
        },
      },
    ],
    grupos: [
      {
        codigo: 'FAMILIA',
        ordem: 3,
        etapaCodigo: 'S1',
        rotulo: 'FAMILIA',
        ocorrencias: { minimo: 0, maximo: null, incluiCandidato: false },
        regras: {
          exibicao: null,
          obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null },
        },
        subitens: [],
      },
    ],
  },
  termos: [],
};

export const PROCESSO = {
  formularios: [GRAVADO],
  cronogramaFases: [{ id: 'F-INSCRICAO', codigo: 'INSCRICAO', coletaInscricao: true }],
};

/** O fato como a leitura pública do catálogo o devolve: no envelope, com os operadores declarados. */
export const PCD_NO_CATALOGO: FatoDoCatalogoDto = {
  fato: {
    id: 'f-pcd',
    codigo: 'PCD',
    nome: 'Pessoa com deficiência',
    descricao: 'Se o candidato é pessoa com deficiência.',
    dominio: DADO_SIM_OU_NAO,
    origem: ORIGEM_DECLARADA,
    cardinalidade: VALOR_UNICO,
    valoresDominio: null,
    pontoResolucao: 'INSCRICAO',
    binding: 'CAMPO_INSCRICAO:PCD',
    valoresDominioDeclarados: null,
    fonteValores: null,
    ativo: true,
    escopo: 'CANDIDATO',
    classificacaoProtecao: 'PESSOAL',
    hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
    finalidadeTratamento: 'Conferir a condição da pessoa com deficiência.',
    protecaoAprovada: true,
  },
  operadoresAdmitidos: [
    { codigo: OperadorDoCatalogo.IGUAL, rotulo: 'é' },
    { codigo: OperadorDoCatalogo.DIFERENTE, rotulo: 'não é' },
  ],
};

export const HABILITACAO_GRAVADA = {
  ...GRAVADO,
  finalidade: { codigo: FinalidadeFormularioCodigo.HABILITACAO, rotulo: 'Habilitação' },
  faseId: 'F-HABILITACAO',
  etapas: [etapa('REVISAO_E_ACEITE', 0, BlocoSistemaCodigo.REVISAO_E_ACEITE)],
  coleta: { itens: [], grupos: [] },
};

const CONTEUDO_VAZIO_DO_MODELO: ModeloFormularioView['conteudo'] = {
  titulo: null,
  etapas: [],
  itens: [],
  termos: [],
  pressupostos: [],
  grupos: [],
  conjuntoDeDocumentos: { documentosExigidos: [], gruposDeDocumentos: [] },
};

const ROTULOS_DAS_FINALIDADES: Record<FinalidadeDoModelo, string> = {
  INSCRICAO: 'Inscrição',
  ISENCAO_TAXA: 'Isenção de taxa',
  HABILITACAO: 'Habilitação',
};

export const modelo = (
  id: string,
  nome: string,
  finalidade: keyof typeof FinalidadeDoModelo,
): ModeloFormularioView => ({
  id,
  codigo: id.toUpperCase(),
  finalidade: {
    codigo: FinalidadeDoModelo[finalidade],
    rotulo: ROTULOS_DAS_FINALIDADES[finalidade],
  },
  ativo: true,
  descritivo: { nome, descricao: null, tipoProcessoCodigo: 'MEDICINA' },
  conteudo: CONTEUDO_VAZIO_DO_MODELO,
});

export const MODELOS = [
  modelo('insc', 'Inscrição de Medicina', 'INSCRICAO'),
  modelo('hab', 'Habilitação padrão', 'HABILITACAO'),
];

export const relato = (finalidade: string) => ({
  finalidade: { codigo: finalidade, rotulo: finalidade },
  fatosTrazidosParaAInscricao: [],
  fatosMantidosNaInscricao: [],
  descartados: [],
  derivacoesCopiadas: [],
  derivacoesMantidas: [],
});

/** A inscrição que a cópia deixa no servidor: sem PCD, que o modelo não traz. */
export const INSCRICAO_COPIADA = {
  ...GRAVADO,
  modeloOrigem: { id: 'insc', codigo: 'INSC' },
  coleta: { itens: [campo('NOME', 0, 'DADOS_BASICOS')], grupos: [] },
};

export const PROCESSO_COM_DERIVACOES = { ...PROCESSO, regrasDerivacao: [] };
