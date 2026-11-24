import {
  CriterioDeVotacaoCodigo,
  DesempateDaVotacaoCodigo,
  EncerramentoDaVotacaoCodigo,
  ModoDeDeliberacao,
  ResultadoSemUnanimidadeCodigo,
} from '@uniplus/shared-data/selecao';
import { valorDoEnum } from './valor-do-enum';

export const MODOS = {
  [ModoDeDeliberacao.atoIndividual]: 'Ato individual',
  [ModoDeDeliberacao.colegiadaComVotacao]: 'Colegiada, com votação',
} satisfies Record<ModoDeDeliberacao, string>;
export const CRITERIOS = {
  [CriterioDeVotacaoCodigo.maioriaSimples]: 'Maioria simples',
  [CriterioDeVotacaoCodigo.maioriaAbsoluta]: 'Maioria absoluta',
  [CriterioDeVotacaoCodigo.unanimidade]: 'Unanimidade',
} satisfies Record<CriterioDeVotacaoCodigo, string>;
export const DESEMPATES = {
  [DesempateDaVotacaoCodigo.votoDaPresidencia]: 'Voto da presidência',
  [DesempateDaVotacaoCodigo.novaVotacao]: 'Nova votação',
} satisfies Record<DesempateDaVotacaoCodigo, string>;
export const ENCERRAMENTOS = {
  [EncerramentoDaVotacaoCodigo.todosOsTitulares]: 'Todos os titulares',
  [EncerramentoDaVotacaoCodigo.presidenciaNoQuorum]: 'A presidência encerra ao atingir o quórum',
} satisfies Record<EncerramentoDaVotacaoCodigo, string>;
export const RESULTADOS = {
  [ResultadoSemUnanimidadeCodigo.favoravel]: 'Favorável',
  [ResultadoSemUnanimidadeCodigo.desfavoravel]: 'Desfavorável',
  [ResultadoSemUnanimidadeCodigo.novaVotacao]: 'Nova votação',
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
