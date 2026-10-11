import type { FatoCandidatoView } from '@uniplus/shared-data/configuracao';

/** Um fato do catálogo como a API o devolve, para os testes da regra de aplicabilidade. */
export function fatoDoCatalogo(
  over: Partial<FatoCandidatoView> & Pick<FatoCandidatoView, 'codigo'>,
): FatoCandidatoView {
  return {
    id: over.codigo,
    nome: over.codigo,
    descricao: null,
    dominio: 'BOOLEANO',
    origem: 'DECLARADO',
    cardinalidade: 'ESCALAR',
    valoresDominio: null,
    pontoResolucao: 'INSCRICAO',
    binding: `CAMPO_FORMULARIO:${over.codigo}`,
    valoresDominioDeclarados: null,
    fonteValores: null,
    ativo: true,
    escopo: 'CANDIDATO',
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

export const CATALOGO: readonly FatoCandidatoView[] = [ESCOLA_PUBLICA, COR_RACA, MODALIDADE];
