import { EtapaDaVersao, TipoDeDivergencia, TipoDeEscopo } from '@uniplus/shared-data/autorizacao';
import type {
  DivergenciaDaGovernancaDto,
  MudancaDaPermissaoDto,
} from '@uniplus/shared-data/autorizacao';

/** A fila da etapa, para onde a pessoa volta da reclassificação. */
export const FILA_DA_ETAPA: Readonly<Record<EtapaDaVersao, string>> = {
  [EtapaDaVersao.GESTAO_DE_ACESSOS]: '/acessos/reclassificacoes/gestao-de-acessos',
  [EtapaDaVersao.PROTECAO_DE_DADOS]: '/acessos/reclassificacoes/protecao-de-dados',
};

/**
 * `De` e `Para` da divergência chegam como texto, sem rótulo da API: o código da classificação
 * ganha aqui o mesmo nome que a API dá a ela nas demais respostas.
 */
const CLASSIFICACAO_NA_DIVERGENCIA: Readonly<Record<string, string>> = {
  PUBLICO: 'Público',
  INTERNO: 'Interno',
  PESSOAL: 'Pessoal',
  IDENTIFICADOR: 'Identificador',
  SENSIVEL: 'Sensível',
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

/** O valor de um lado da divergência, na linguagem do tipo dela; sem valor, o traço. */
export function valorDaDivergencia(
  tipo: DivergenciaDaGovernancaDto['tipo'],
  valor: string | null,
): string {
  if (valor === null) return '—';
  if (tipo.codigo === TipoDeDivergencia.CLASSIFICACAO) {
    return CLASSIFICACAO_NA_DIVERGENCIA[valor.toUpperCase()] ?? valor;
  }
  if (tipo.codigo === TipoDeDivergencia.ESCOPO) {
    return escopoDaPermissao(valor === TipoDeEscopo.UNIDADE);
  }
  return valor;
}
