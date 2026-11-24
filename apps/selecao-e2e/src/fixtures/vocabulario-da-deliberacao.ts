import {
  CriterioDeVotacaoCodigo,
  DesempateDaVotacaoCodigo,
  EncerramentoDaVotacaoCodigo,
  ModoDeDeliberacao,
  ResultadoSemUnanimidadeCodigo,
} from '@uniplus/shared-data/selecao';
import { valorDoEnum } from './valor-do-enum';

export const MODOS = {
  [ModoDeDeliberacao.ATO_INDIVIDUAL]: 'Ato individual',
  [ModoDeDeliberacao.COLEGIADA_COM_VOTACAO]: 'Colegiada, com votação',
} satisfies Record<ModoDeDeliberacao, string>;
export const CRITERIOS = {
  [CriterioDeVotacaoCodigo.MAIORIA_SIMPLES]: 'Maioria simples',
  [CriterioDeVotacaoCodigo.MAIORIA_ABSOLUTA]: 'Maioria absoluta',
  [CriterioDeVotacaoCodigo.UNANIMIDADE]: 'Unanimidade',
} satisfies Record<CriterioDeVotacaoCodigo, string>;
export const DESEMPATES = {
  [DesempateDaVotacaoCodigo.VOTO_DA_PRESIDENCIA]: 'Voto da presidência',
  [DesempateDaVotacaoCodigo.NOVA_VOTACAO]: 'Nova votação',
} satisfies Record<DesempateDaVotacaoCodigo, string>;
export const ENCERRAMENTOS = {
  [EncerramentoDaVotacaoCodigo.TODOS_OS_TITULARES]: 'Todos os titulares',
  [EncerramentoDaVotacaoCodigo.PRESIDENCIA_NO_QUORUM]: 'A presidência encerra ao atingir o quórum',
} satisfies Record<EncerramentoDaVotacaoCodigo, string>;
export const RESULTADOS = {
  [ResultadoSemUnanimidadeCodigo.FAVORAVEL]: 'Favorável',
  [ResultadoSemUnanimidadeCodigo.DESFAVORAVEL]: 'Desfavorável',
  [ResultadoSemUnanimidadeCodigo.NOVA_VOTACAO]: 'Nova votação',
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
