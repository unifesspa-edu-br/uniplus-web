import type {
  CriterioDeVotacaoCodigo,
  DesempateDaVotacaoCodigo,
  EncerramentoDaVotacaoCodigo,
  ModoDeDeliberacao,
  ResultadoSemUnanimidadeCodigo,
} from '@uniplus/shared-data/selecao';
import { valorDoEnum } from './valor-do-enum';

export const MODOS = {
  ATO_INDIVIDUAL: 'Ato individual',
  COLEGIADA_COM_VOTACAO: 'Colegiada, com votação',
} satisfies Record<ModoDeDeliberacao, string>;
export const CRITERIOS = {
  MAIORIA_SIMPLES: 'Maioria simples',
  MAIORIA_ABSOLUTA: 'Maioria absoluta',
  UNANIMIDADE: 'Unanimidade',
} satisfies Record<CriterioDeVotacaoCodigo, string>;
export const DESEMPATES = {
  VOTO_DA_PRESIDENCIA: 'Voto da presidência',
  NOVA_VOTACAO: 'Nova votação',
} satisfies Record<DesempateDaVotacaoCodigo, string>;
export const ENCERRAMENTOS = {
  TODOS_OS_TITULARES: 'Todos os titulares',
  PRESIDENCIA_NO_QUORUM: 'A presidência encerra ao atingir o quórum',
} satisfies Record<EncerramentoDaVotacaoCodigo, string>;
export const RESULTADOS = {
  FAVORAVEL: 'Favorável',
  DESFAVORAVEL: 'Desfavorável',
  NOVA_VOTACAO: 'Nova votação',
} satisfies Record<ResultadoSemUnanimidadeCodigo, string>;

export function valorDaDeliberacao<Codigo extends string>(
  codigo: Codigo,
  rotulos: Record<Codigo, string>,
) {
  return valorDoEnum(codigo, rotulos[codigo]);
}

export function valorOpcionalDaDeliberacao<Codigo extends string>(
  codigo: Codigo | null | undefined,
  rotulos: Record<Codigo, string>,
) {
  return codigo == null ? null : valorDaDeliberacao(codigo, rotulos);
}
