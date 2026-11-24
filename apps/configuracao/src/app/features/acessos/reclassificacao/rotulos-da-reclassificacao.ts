import { EtapaDaVersao, TipoDeDivergencia, TipoDeEscopo } from '@uniplus/shared-data/autorizacao';
import type { MudancaDaPermissaoDto } from '@uniplus/shared-data/autorizacao';
import { sensibilidade } from '../rotulos-de-acesso';

/** A fila da etapa, para onde a pessoa volta da reclassificação. */
export const FILA_DA_ETAPA: Readonly<Record<EtapaDaVersao, string>> = {
  [EtapaDaVersao.GESTAO_DE_ACESSOS]: '/acessos/reclassificacoes/gestao-de-acessos',
  [EtapaDaVersao.PROTECAO_DE_DADOS]: '/acessos/reclassificacoes/protecao-de-dados',
};

const TIPO_DA_DIVERGENCIA: Readonly<Record<TipoDeDivergencia, string>> = {
  [TipoDeDivergencia.COMPOSICAO_FALTANTE]: 'Permissão que falta na composição',
  [TipoDeDivergencia.COMPOSICAO_EXCEDENTE]: 'Permissão a mais na composição',
  [TipoDeDivergencia.CLASSIFICACAO]: 'Classificação diferente do catálogo',
  [TipoDeDivergencia.ESCOPO]: 'Escopo diferente do catálogo',
};

export function escopoDaPermissao(deUnidade: boolean): string {
  return deUnidade ? 'Unidade' : 'Instituição';
}

export function tipoDaDivergencia(tipo: string): string {
  return TIPO_DA_DIVERGENCIA[tipo as TipoDeDivergencia] ?? tipo;
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

/** O valor de um lado da divergência, na linguagem do tipo dela; sem valor, o traço. */
export function valorDaDivergencia(tipo: string, valor: string | null): string {
  if (valor === null) return '—';
  if (tipo === TipoDeDivergencia.CLASSIFICACAO) return sensibilidade(valor);
  if (tipo === TipoDeDivergencia.ESCOPO) return escopoDaPermissao(valor === TipoDeEscopo.UNIDADE);
  return valor;
}
