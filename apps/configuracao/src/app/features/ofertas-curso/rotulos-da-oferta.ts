import {
  LocalOfertaDto,
  type CursoDto,
  type UnidadeOfertanteDto,
} from '@uniplus/shared-data/configuracao';

/**
 * O curso tem dois rótulos com propósitos distintos: a coluna da tabela exibe só o nome, porque as
 * demais colunas da linha já situam a oferta; fora dela o curso aparece sozinho (confirmação de
 * remoção, campos do formulário) e o código é o que distingue cursos de nome semelhante.
 */
export const rotularCursoNaListagem = (curso: CursoDto): string => curso.nome;

export const rotularCursoCompleto = (curso: CursoDto): string => `${curso.codigo} — ${curso.nome}`;

export const rotularTipoLocal = (local: LocalOfertaDto): string => local.tipo.rotulo;

export const rotularLocalOferta = (local: LocalOfertaDto): string =>
  `${rotularTipoLocal(local)} — ${local.cidade.nome}`;

export const rotularCidadeETipo = (local: LocalOfertaDto): string =>
  `${local.cidade.nome} · ${rotularTipoLocal(local)}`;

export const rotularGrauENivel = (curso: CursoDto): string =>
  `${curso.grau} · ${curso.nivelEnsino}`;

export const rotularUnidade = (
  unidade: Pick<UnidadeOfertanteDto, 'sigla' | 'nome' | 'tipo'>,
): string => `${unidade.sigla} · ${unidade.nome} · ${unidade.tipo}`;

type ValorRotulado = { readonly rotulo: string };

export const rotuloDoPrograma = (valor: ValorRotulado): string => valor.rotulo;
export const rotuloDoFormato = (valor: ValorRotulado): string => valor.rotulo;
export const rotuloDoRegimeDeTurno = (valor: ValorRotulado): string => valor.rotulo;
export const rotuloDoRegimeDeFuncionamento = (valor: ValorRotulado): string => valor.rotulo;

export function rotuloDosTurnos(valores: readonly ValorRotulado[]): string {
  return valores.length ? valores.map((valor) => valor.rotulo).join(' e ') : '—';
}
