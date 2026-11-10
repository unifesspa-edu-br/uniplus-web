import type { EtapaDaVersao, MudancaDaPermissaoDto } from '@uniplus/shared-data/autorizacao';
import { sensibilidade } from '../rotulos-de-acesso';

/** A fila da etapa, para onde a pessoa volta da reclassificação. */
export const FILA_DA_ETAPA: Readonly<Record<EtapaDaVersao, string>> = {
  gestao_de_acessos: '/acessos/reclassificacoes/gestao-de-acessos',
  protecao_de_dados: '/acessos/reclassificacoes/protecao-de-dados',
};

export function escopoDaPermissao(deUnidade: boolean): string {
  return deUnidade ? 'Unidade' : 'Instituição';
}

/** O que mudou na permissão, em uma frase por eixo; o eixo que não mudou não aparece. */
export function mudancasDaPermissao(mudanca: MudancaDaPermissaoDto): readonly string[] {
  const dessas: string[] = [];
  if (mudanca.classificacaoAnterior !== mudanca.classificacaoNova) {
    dessas.push(
      `Classificação: de ${sensibilidade(mudanca.classificacaoAnterior)} para ${sensibilidade(mudanca.classificacaoNova)}`,
    );
  }
  if (mudanca.deUnidadeAnterior !== mudanca.deUnidadeNovo) {
    dessas.push(
      `Escopo: de ${escopoDaPermissao(mudanca.deUnidadeAnterior)} para ${escopoDaPermissao(mudanca.deUnidadeNovo)}`,
    );
  }
  return dessas;
}
