import {
  FORMATOS_PEDAGOGICOS,
  LocalOfertaDto,
  PROGRAMAS_DE_OFERTA,
  REGIMES_DE_FUNCIONAMENTO,
  REGIMES_DE_TURNO,
  TIPOS_LOCAL_OFERTA,
  TURNOS_OFERTA,
  ordenarTurnosCanonicamente,
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

export const rotularTipoLocal = (local: LocalOfertaDto): string =>
  TIPOS_LOCAL_OFERTA.find((tipo) => tipo.value === local.tipo)?.label ?? local.tipo;

export const rotularLocalOferta = (local: LocalOfertaDto): string =>
  `${rotularTipoLocal(local)} — ${local.cidade.nome}`;

export const rotularCidadeETipo = (local: LocalOfertaDto): string =>
  `${local.cidade.nome} · ${rotularTipoLocal(local)}`;

export const rotularGrauENivel = (curso: CursoDto): string =>
  `${curso.grau} · ${curso.nivelEnsino}`;

export const rotularUnidade = (
  unidade: Pick<UnidadeOfertanteDto, 'sigla' | 'nome' | 'tipo'>,
): string => `${unidade.sigla} · ${unidade.nome} · ${unidade.tipo}`;

const rotuloDe = (
  opcoes: readonly { readonly value: string; readonly label: string }[],
  token: string,
): string => opcoes.find((opcao) => opcao.value === token)?.label ?? token;

export const rotuloDoPrograma = (token: string): string => rotuloDe(PROGRAMAS_DE_OFERTA, token);

export const rotuloDoFormato = (token: string): string => rotuloDe(FORMATOS_PEDAGOGICOS, token);

export const rotuloDoRegimeDeTurno = (token: string): string => rotuloDe(REGIMES_DE_TURNO, token);

export const rotuloDoRegimeDeFuncionamento = (token: string): string =>
  rotuloDe(REGIMES_DE_FUNCIONAMENTO, token);

export function rotuloDosTurnos(tokens: readonly string[]): string {
  if (tokens.length === 0) {
    return '—';
  }
  return ordenarTurnosCanonicamente(tokens)
    .map((token) => rotuloDe(TURNOS_OFERTA, token))
    .join(' e ');
}
