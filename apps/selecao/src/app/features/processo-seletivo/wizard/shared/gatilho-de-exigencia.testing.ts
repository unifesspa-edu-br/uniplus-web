import { OperadorCodigo, type FatoCandidatoComOperadores } from '@uniplus/shared-data/configuracao';

import type { ExigenciaDeDocumento } from '../processo-seletivo.models';
import { fatoEscolhivel, fatosParaGatilho, type FatoEscolhivel } from './gatilho-de-exigencia';

const PERTINENCIA = [
  { codigo: OperadorCodigo.IGUAL, rotulo: 'é' },
  { codigo: OperadorCodigo.DIFERENTE, rotulo: 'não é' },
  { codigo: OperadorCodigo.EM, rotulo: 'é um de' },
  { codigo: OperadorCodigo.NAO_EM, rotulo: 'não é nenhum de' },
] as const;
const IGUALDADE = [
  { codigo: OperadorCodigo.IGUAL, rotulo: 'é' },
  { codigo: OperadorCodigo.DIFERENTE, rotulo: 'não é' },
] as const;
const COMPARACAO = [
  { codigo: OperadorCodigo.IGUAL, rotulo: 'é igual a' },
  { codigo: OperadorCodigo.DIFERENTE, rotulo: 'é diferente de' },
  { codigo: OperadorCodigo.MAIOR_IGUAL, rotulo: 'é maior ou igual a' },
  { codigo: OperadorCodigo.MENOR_IGUAL, rotulo: 'é menor ou igual a' },
] as const;

const FATO_PADRAO = {
  operadoresAdmitidos: PERTINENCIA,
  nome: '',
  descricao: null,
  dominio: 'CATEGORICO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  valoresDominioDeclarados: null,
} as const;

/** Um fato do catálogo, na forma em que a API o entrega. */
export function view(
  parcial: Partial<FatoCandidatoComOperadores> & Pick<FatoCandidatoComOperadores, 'codigo'>,
): FatoCandidatoComOperadores {
  const { codigo } = parcial;
  const id = `00000000-0000-0000-0000-${codigo.length.toString().padStart(12, '0')}`;
  const identidade = { id, nome: codigo, binding: `CAMPO_INSCRICAO:${codigo}` };
  return { ...FATO_PADRAO, ...identidade, ...parcial } as FatoCandidatoComOperadores;
}

export const SEXO = view({
  codigo: 'SEXO',
  nome: 'Sexo',
  valoresDominio: ['MASCULINO', 'FEMININO', 'INTERSEXO'],
});

export const NACIONALIDADE = view({
  codigo: 'NACIONALIDADE',
  nome: 'Nacionalidade',
  valoresDominio: ['BRASILEIRA', 'NATURALIZADA', 'ESTRANGEIRA'],
});

export const COR_RACA = view({
  codigo: 'COR_RACA',
  nome: 'Cor ou raça',
  valoresDominio: ['BRANCA', 'PRETA', 'PARDA', 'INDIGENA', 'AMARELA'],
});

export const FAIXA_ETARIA = view({
  codigo: 'FAIXA_ETARIA',
  nome: 'Faixa etária',
  dominio: 'NUMERICO',
  origem: 'DERIVADO',
  binding: 'ATRIBUTO_CANDIDATO:FAIXA_ETARIA',
  operadoresAdmitidos: COMPARACAO,
});

export const PCD = view({
  codigo: 'PCD',
  nome: 'Pessoa com deficiência',
  dominio: 'BOOLEANO',
  operadoresAdmitidos: IGUALDADE,
});

export const MODALIDADE = view({
  codigo: 'MODALIDADE',
  nome: 'Modalidade de concorrência',
  origem: 'DERIVADO',
  cardinalidade: 'MULTIVALORADO',
  binding: 'REGRA_DERIVACAO:MODALIDADE',
});

export const CONDICAO_ATENDIMENTO = view({
  codigo: 'CONDICAO_ATENDIMENTO',
  nome: 'Condição de atendimento especializado',
  cardinalidade: 'MULTIVALORADO',
});

export const CATALOGO = [
  SEXO,
  NACIONALIDADE,
  COR_RACA,
  FAIXA_ETARIA,
  PCD,
  MODALIDADE,
  CONDICAO_ATENDIMENTO,
];

export function escolhivel(fato: FatoCandidatoComOperadores): FatoEscolhivel {
  const traduzido = fatoEscolhivel(fato);
  if (traduzido === null) throw new Error(`Fato sem domínio conhecido: ${fato.codigo}`);
  return traduzido;
}

const EXIGENCIA_PADRAO: ExigenciaDeDocumento = {
  tipoDocumentoId: 'titulo-de-eleitor',
  faseCodigo: 'INSCRICAO',
  etapaId: null,
  finalidade: null,
  aplicabilidade: 'CONDICIONAL',
  obrigatorio: true,
  consequenciaIndeferimento: '',
  condicoes: [],
  basesLegais: [],
  idadeMaximaEmissao: null,
  formatosPermitidos: { tipo: 'qualquer' } as const,
  tamanhoMaximoBytes: null,
  modelo: null,
};

export function exigencia(parcial: Partial<ExigenciaDeDocumento> = {}): ExigenciaDeDocumento {
  return { ...EXIGENCIA_PADRAO, ...parcial };
}

export function catalogo(): ReadonlyMap<string, FatoEscolhivel> {
  return new Map(fatosParaGatilho(CATALOGO).map((fato) => [fato.codigo, fato]));
}
