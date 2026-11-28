import { EtapaDaVersao } from '@uniplus/shared-data/autorizacao';
import type {
  DivergenciaDaGovernancaDto,
  MudancaDaPermissaoDto,
} from '@uniplus/shared-data/autorizacao';

/** A fila da etapa, para onde a pessoa volta da reclassificação. */
export const FILA_DA_ETAPA: Readonly<Record<EtapaDaVersao, string>> = {
  [EtapaDaVersao.GESTAO_DE_ACESSOS]: '/acessos/reclassificacoes/gestao-de-acessos',
  [EtapaDaVersao.PROTECAO_DE_DADOS]: '/acessos/reclassificacoes/protecao-de-dados',
};

export function escopoDaPermissao(deUnidade: boolean): string {
  return deUnidade ? 'Unidade' : 'Instituição';
}

/** O que mudou na permissão, em uma frase por eixo; o eixo que não mudou não aparece. */
export function mudancasDaPermissao(mudanca: MudancaDaPermissaoDto): readonly string[] {
  const dessas: string[] = [];
  if (mudanca.classificacaoAnterior.codigo !== mudanca.classificacaoNova.codigo) {
    dessas.push(
      `Classificação: de ${mudanca.classificacaoAnterior.rotulo} para ${mudanca.classificacaoNova.rotulo}`,
    );
  }
  if (mudanca.deUnidadeAnterior !== mudanca.deUnidadeNovo) {
    dessas.push(
      `Escopo: de ${escopoDaPermissao(mudanca.deUnidadeAnterior)} para ${escopoDaPermissao(mudanca.deUnidadeNovo)}`,
    );
  }
  return dessas;
}

export type LadoDaDivergencia = 'anterior' | 'nova';

/**
 * O valor de um lado da divergência: o rótulo da classificação que a API devolve ou o escopo
 * em palavras; sem valor nesse lado, o traço.
 */
export function valorDaDivergencia(
  divergencia: DivergenciaDaGovernancaDto,
  lado: LadoDaDivergencia,
): string {
  const anterior = lado === 'anterior';
  const classificacao = anterior
    ? divergencia.classificacaoAnterior
    : divergencia.classificacaoNova;
  if (classificacao !== null) return classificacao.rotulo;
  const deUnidade = anterior ? divergencia.deUnidadeAnterior : divergencia.deUnidadeNovo;
  return deUnidade === null ? '—' : escopoDaPermissao(deUnidade);
}
