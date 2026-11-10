import type { EtapaDaVersao, MudancaDaPermissaoDto } from '@uniplus/shared-data/autorizacao';
import { sensibilidade } from '../rotulos-de-acesso';

/** A fila da etapa, para onde a pessoa volta da reclassificação. */
export const FILA_DA_ETAPA: Readonly<Record<EtapaDaVersao, string>> = {
  gestao_de_acessos: '/acessos/reclassificacoes/gestao-de-acessos',
  protecao_de_dados: '/acessos/reclassificacoes/protecao-de-dados',
};

const TIPO_DA_DIVERGENCIA: Readonly<Record<string, string>> = {
  composicao_faltante: 'Permissão que falta na composição',
  composicao_excedente: 'Permissão a mais na composição',
  classificacao: 'Classificação diferente do catálogo',
  escopo: 'Escopo diferente do catálogo',
};

export function escopoDaPermissao(deUnidade: boolean): string {
  return deUnidade ? 'Unidade' : 'Instituição';
}

export function tipoDaDivergencia(tipo: string): string {
  return TIPO_DA_DIVERGENCIA[tipo] ?? tipo;
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
  if (tipo === 'classificacao') return sensibilidade(valor);
  if (tipo === 'escopo') return escopoDaPermissao(valor.toLowerCase() === 'unidade');
  return valor;
}
