import {
  OperadorCodigo,
  type FatoCandidatoView,
  type FatoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';

const FATO_BOOLEANO: Omit<FatoCandidatoView, 'id' | 'codigo' | 'nome' | 'binding'> = {
  descricao: 'Dado do candidato.',
  dominio: 'BOOLEANO',
  origem: 'DECLARADO',
  cardinalidade: 'ESCALAR',
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  escopo: 'CANDIDATO',
  classificacaoProtecao: 'INTERNO',
  hipoteseLegal: 'EXECUCAO_POLITICAS_PUBLICAS',
  finalidadeTratamento: 'Aplicar a regra do certame.',
  protecaoAprovada: true,
};

/** Um fato do catálogo como a API o devolve, para os testes da regra de aplicabilidade. */
export function fatoDoCatalogo(
  over: Partial<FatoCandidatoView> & Pick<FatoCandidatoView, 'codigo'>,
): FatoCandidatoView {
  return {
    ...FATO_BOOLEANO,
    id: over.codigo,
    nome: over.codigo,
    binding: `CAMPO_INSCRICAO:${over.codigo}`,
    ...over,
  };
}

export const ESCOLA_PUBLICA = fatoDoCatalogo({
  codigo: 'ESCOLA_PUBLICA',
  nome: 'Cursou o ensino médio em escola pública',
});

export const COR_RACA = fatoDoCatalogo({
  codigo: 'COR_RACA',
  nome: 'Cor/raça',
  dominio: 'CATEGORICO',
  valoresDominio: ['PRETA', 'PARDA', 'INDIGENA'],
  valoresDominioDeclarados: [
    { codigo: 'PRETA', descricao: 'Preta', ordem: 1, ativo: true },
    { codigo: 'PARDA', descricao: 'Parda', ordem: 2, ativo: true },
    { codigo: 'INDIGENA', descricao: 'Indígena', ordem: 3, ativo: true },
  ],
});

/** O fato da própria modalidade: a regra de aplicabilidade não pode citá-lo. */
export const MODALIDADE = fatoDoCatalogo({
  codigo: 'MODALIDADE',
  nome: 'Modalidade de concorrência',
  dominio: 'CATEGORICO',
  origem: 'DERIVADO',
  valoresDominio: ['AC', 'LB_PPI'],
  binding: 'REGRA:MODALIDADE',
});

const IGUALDADE = [
  { codigo: OperadorCodigo.IGUAL, rotulo: 'é' },
  { codigo: OperadorCodigo.DIFERENTE, rotulo: 'não é' },
] as const;

const PERTINENCIA = [
  { codigo: OperadorCodigo.EM, rotulo: 'é um de' },
  { codigo: OperadorCodigo.NAO_EM, rotulo: 'não é nenhum de' },
] as const;

const CATEGORICO = [...IGUALDADE, ...PERTINENCIA] as const;

/** A leitura pública do catálogo: cada fato no envelope, com os operadores que ele admite. */
export const CATALOGO: readonly FatoDoCatalogoDto[] = [
  { fato: ESCOLA_PUBLICA, operadoresAdmitidos: IGUALDADE },
  { fato: COR_RACA, operadoresAdmitidos: CATEGORICO },
  { fato: MODALIDADE, operadoresAdmitidos: CATEGORICO },
];
