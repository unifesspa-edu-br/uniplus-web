import { EscopoFatoCodigo } from '@uniplus/shared-data/configuracao';
import { codigoComRotulo } from '@uniplus/shared-testing/contrato';
import {
  DADO_NUMERICO,
  DADO_OPCAO,
  DADO_SIM_OU_NAO,
  ORIGEM_CALCULADA,
  ORIGEM_DECLARADA,
  VALOR_UNICO,
} from '../../shared/valores-do-catalogo.testing';
import { OperadorCodigo, type FatoCandidatoComOperadores } from '@uniplus/shared-data/configuracao';
import {
  apresentacaoDaPagina,
  apresentacaoDoCampo,
  REGRAS_INICIAIS,
  type ConteudoDoFormulario,
  type PaginaDoFormulario,
  type ItemDoFormulario,
} from '@uniplus/shared-inscricao/formulario';
import type {
  CriterioDesempateConfigurado,
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  FormularioDeInscricao,
  FormularioDoProcessoNoRascunho,
} from '../../processo-seletivo.models';
import {
  comExigenciaSemGrupo,
  exigenciaNova,
} from '../../shared/exigencias/exigencias-documentais';

export const ID_TITULO = '01960000-0000-7000-0000-0000000000d1';
export const ID_RESERVISTA = '01960000-0000-7000-0000-0000000000d2';

const IGUALDADE = [
  { codigo: OperadorCodigo.IGUAL, rotulo: 'é' },
  { codigo: OperadorCodigo.DIFERENTE, rotulo: 'não é' },
] as const;
const PERTINENCIA = [
  { codigo: OperadorCodigo.IGUAL, rotulo: 'é' },
  { codigo: OperadorCodigo.DIFERENTE, rotulo: 'não é' },
  { codigo: OperadorCodigo.ALGUM_DE, rotulo: 'é um de' },
  { codigo: OperadorCodigo.NENHUM_DE, rotulo: 'não é nenhum de' },
] as const;
const COMPARACAO = [
  { codigo: OperadorCodigo.IGUAL, rotulo: 'é igual a' },
  { codigo: OperadorCodigo.DIFERENTE, rotulo: 'é diferente de' },
  { codigo: OperadorCodigo.MAIOR_IGUAL, rotulo: 'é maior ou igual a' },
  { codigo: OperadorCodigo.MENOR_IGUAL, rotulo: 'é menor ou igual a' },
] as const;

const FATO_DECLARADO = {
  operadoresAdmitidos: IGUALDADE,
  id: 'f',
  descricao: null,
  dominio: DADO_SIM_OU_NAO,
  origem: ORIGEM_DECLARADA,
  cardinalidade: VALOR_UNICO,
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  escopo: codigoComRotulo(EscopoFatoCodigo.CANDIDATO, 'Candidato'),
  fonteValores: null,
  ativo: true,
  valoresDominioDeclarados: null,
};

/** O catálogo como o servidor o publica — o que a tela pode coletar sai daqui. */
export function fato(
  patch: Partial<FatoCandidatoComOperadores> & { codigo: string },
): FatoCandidatoComOperadores {
  return {
    ...FATO_DECLARADO,
    nome: patch.codigo,
    binding: `CAMPO_INSCRICAO:${patch.codigo}`,
    ...patch,
  } as unknown as FatoCandidatoComOperadores;
}

export const SEXO = fato({
  codigo: 'SEXO',
  nome: 'Sexo',
  dominio: DADO_OPCAO,
  operadoresAdmitidos: PERTINENCIA,
});
export const PCD = fato({ codigo: 'PCD', nome: 'Pessoa com deficiência' });
export const RENDA = fato({
  codigo: 'RENDA_FAMILIAR',
  nome: 'Renda familiar',
  dominio: DADO_NUMERICO,
  operadoresAdmitidos: COMPARACAO,
});
export const MODALIDADE = fato({
  codigo: 'MODALIDADE',
  origem: ORIGEM_CALCULADA,
  binding: 'REGRA_DERIVACAO:MODALIDADE',
  dominio: DADO_OPCAO,
  operadoresAdmitidos: PERTINENCIA,
});
export const CATALOGO = [SEXO, PCD, RENDA, MODALIDADE];

export const secao = (
  codigo: string,
  ordem: number,
  extra: Partial<PaginaDoFormulario> = {},
): PaginaDoFormulario => ({
  codigo,
  ordem,
  tipo: 'SECAO',
  bloco: null,
  apresentacao: apresentacaoDaPagina(codigo),
  exibicao: null,
  ...extra,
});
export const bloco = (codigo: string, ordem: number): PaginaDoFormulario => ({
  ...secao(codigo, ordem),
  tipo: 'BLOCO',
  bloco: codigo,
});
export const item = (
  fatoCodigo: string,
  ordem: number,
  paginaCodigo: string,
  extra: Partial<ItemDoFormulario> = {},
): ItemDoFormulario => ({
  fatoCodigo,
  ordem,
  paginaCodigo,
  apresentacao: apresentacaoDoCampo(fatoCodigo, 'SIM_OU_NAO'),
  regras: REGRAS_INICIAIS,
  ...extra,
});

/** A inscrição como o servidor a devolve: os dados básicos, uma seção do certame, e os blocos. */
export function inscricaoGravada(extra: Partial<ConteudoDoFormulario> = {}): ConteudoDoFormulario {
  return {
    titulo: null,
    paginas: paginasDaInscricao(),
    itens: [
      item('NOME', 0, 'DADOS_BASICOS'),
      item('SEXO', 1, 'DADOS_BASICOS'),
      item('PCD', 2, 'S1'),
    ],
    termos: [],
    pressupostos: [],
    grupos: [],
    ...extra,
  };
}

const paginasDaInscricao = (): PaginaDoFormulario[] => [
  secao('DADOS_BASICOS', 0),
  secao('S1', 1),
  bloco('COMPROVACAO_DOCUMENTAL', 2),
  bloco('REVISAO_E_ACEITE', 3),
];

export const CODIGO_DA_INSCRICAO = 'INSCRICAO';

/** O formulário do rascunho: por padrão o da inscrição, obrigatório, na fase de inscrição. */
export function formularioDoRascunho(
  conteudo: ConteudoDoFormulario,
  extra: Partial<FormularioDoProcessoNoRascunho> = {},
): FormularioDoProcessoNoRascunho {
  return {
    codigo: CODIGO_DA_INSCRICAO,
    gravado: false,
    faseCodigo: 'INSCRICAO',
    obrigatorio: true,
    consequenciaDaFaltaDeEnvio: null,
    conteudo,
    modeloOrigemCodigo: null,
    ...extra,
  };
}

/** O rascunho dos formulários com o da inscrição e os outros dados, em `outros`. */
export function formularioCom(
  conteudo: ConteudoDoFormulario,
  extra: Partial<FormularioDeInscricao> = {},
  outros: readonly FormularioDoProcessoNoRascunho[] = [],
): FormularioDeInscricao {
  return {
    formularios: [formularioDoRascunho(conteudo), ...outros],
    referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
    derivacao: [],
    ...extra,
  };
}

/**
 * O que a seção do formulário passa a ter quando a inscrição ganha o conteúdo dado: troca a
 * inscrição que já existe ou a acrescenta. Os demais formulários ficam como estão.
 */
export function comInscricao(
  atual: FormularioDeInscricao,
  conteudo: ConteudoDoFormulario,
  extra: Partial<FormularioDoProcessoNoRascunho> = {},
): Pick<FormularioDeInscricao, 'formularios'> {
  const existente = atual.formularios.find((item) => item.codigo === CODIGO_DA_INSCRICAO);
  const nova = { ...(existente ?? formularioDoRascunho(conteudo)), ...extra, conteudo };
  const outros = atual.formularios.filter((item) => item.codigo !== CODIGO_DA_INSCRICAO);
  return { formularios: [nova, ...outros] };
}

/** Uma exigência com o gatilho dado, na fase da habilitação. */
export function exigenciaCom(
  tipoDocumentoId: string,
  condicoes: readonly { fato: string; operador: string; valor: string }[],
): ExigenciaDeDocumento {
  return {
    ...exigenciaNova(tipoDocumentoId, 'HABILITACAO'),
    aplicabilidade: 'CONDICIONAL',
    condicoes: condicoes.map((c, i) => ({ clausula: 0, ...c, ordem: i })),
  } as ExigenciaDeDocumento;
}

export function rascunhoCom(...exigencias: readonly ExigenciaDeDocumento[]): ExigenciasDoRascunho {
  return exigencias.reduce<ExigenciasDoRascunho>(
    (acumulado, atual) => comExigenciaSemGrupo(acumulado, atual),
    { regrasDeComprovacao: [], emTodasAsFases: [] },
  );
}

export const NENHUMA_EXIGENCIA: ExigenciasDoRascunho = {
  regrasDeComprovacao: [],
  emTodasAsFases: [],
};
export const MAIOR_IDADE = { regraCodigo: 'DESEMPATE_MAIOR_IDADE' } as CriterioDesempateConfigurado;
