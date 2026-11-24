import {
  OperadorCodigo,
  TipoDoDadoCodigo,
  OrigemFatoCodigo,
  QuantidadeDeValoresCodigo,
  type FatoCandidatoView,
  type FatoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';

const FATO_BOOLEANO: Omit<FatoCandidatoView, 'id' | 'codigo' | 'nome' | 'binding'> = {
  descricao: 'Dado do candidato.',
  dominio: { codigo: TipoDoDadoCodigo.SIM_OU_NAO, rotulo: 'Sim ou não' },
  origem: { codigo: OrigemFatoCodigo.DECLARADO, rotulo: 'Declarado' },
  cardinalidade: { codigo: QuantidadeDeValoresCodigo.VALOR_UNICO, rotulo: 'Um valor' },
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
  dominio: { codigo: TipoDoDadoCodigo.OPCAO, rotulo: 'Opção' },
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
  dominio: { codigo: TipoDoDadoCodigo.OPCAO, rotulo: 'Opção' },
  origem: { codigo: OrigemFatoCodigo.CALCULADO, rotulo: 'Calculado' },
  valoresDominio: ['AC', 'LB_PPI'],
  binding: 'REGRA:MODALIDADE',
});

const IGUALDADE = [
  { codigo: OperadorCodigo.IGUAL, rotulo: 'é' },
  { codigo: OperadorCodigo.DIFERENTE, rotulo: 'não é' },
] as const;

const PERTINENCIA = [
  { codigo: OperadorCodigo.ALGUM_DE, rotulo: 'é um de' },
  { codigo: OperadorCodigo.NENHUM_DE, rotulo: 'não é nenhum de' },
] as const;

const CATEGORICO = [...IGUALDADE, ...PERTINENCIA] as const;

/** A leitura pública do catálogo: cada fato no envelope, com os operadores que ele admite. */
export const CATALOGO: readonly FatoDoCatalogoDto[] = [
  { fato: ESCOLA_PUBLICA, operadoresAdmitidos: IGUALDADE },
  { fato: COR_RACA, operadoresAdmitidos: CATEGORICO },
  { fato: MODALIDADE, operadoresAdmitidos: CATEGORICO },
];
