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
  apresentacaoDaEtapa,
  apresentacaoDoCampo,
  REGRAS_INICIAIS,
  type ConteudoDoFormulario,
  type EtapaDoFormulario,
  type ItemDoFormulario,
} from '@uniplus/shared-ui/components';
import type {
  CriterioDesempateConfigurado,
  ExigenciaDeDocumento,
  ExigenciasDoRascunho,
  FormularioDeInscricao,
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
  escopo: 'CANDIDATO',
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
  extra: Partial<EtapaDoFormulario> = {},
): EtapaDoFormulario => ({
  codigo,
  ordem,
  tipo: 'SECAO',
  bloco: null,
  apresentacao: apresentacaoDaEtapa(codigo),
  exibicao: null,
  ...extra,
});
export const bloco = (codigo: string, ordem: number): EtapaDoFormulario => ({
  ...secao(codigo, ordem),
  tipo: 'BLOCO',
  bloco: codigo,
});
export const item = (
  fatoCodigo: string,
  ordem: number,
  etapaCodigo: string,
  extra: Partial<ItemDoFormulario> = {},
): ItemDoFormulario => ({
  fatoCodigo,
  ordem,
  etapaCodigo,
  apresentacao: apresentacaoDoCampo(fatoCodigo, 'BOOLEANO'),
  regras: REGRAS_INICIAIS,
  ...extra,
});

/** A inscrição como o servidor a devolve: os dados básicos, uma seção do certame, e os blocos. */
export function inscricaoGravada(extra: Partial<ConteudoDoFormulario> = {}): ConteudoDoFormulario {
  return {
    titulo: null,
    etapas: etapasDaInscricao(),
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

const etapasDaInscricao = (): EtapaDoFormulario[] => [
  secao('DADOS_BASICOS', 0),
  secao('S1', 1),
  bloco('COMPROVACAO_DOCUMENTAL', 2),
  bloco('REVISAO_E_ACEITE', 3),
];

export function formularioCom(
  conteudo: ConteudoDoFormulario,
  extra: Partial<FormularioDeInscricao> = {},
): FormularioDeInscricao {
  return {
    faseCodigo: 'INSCRICAO',
    conteudo,
    referenciaTemporal: { tipo: '', data: '', faseCodigo: '' },
    derivacao: [],
    outrasFinalidades: [],
    ...extra,
  };
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
export const MAIOR_IDADE = { regraCodigo: 'DESEMPATE-MAIOR-IDADE' } as CriterioDesempateConfigurado;
