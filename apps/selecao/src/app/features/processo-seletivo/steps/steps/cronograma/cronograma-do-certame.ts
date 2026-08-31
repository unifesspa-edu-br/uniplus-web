import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';

/** Origem de data que obriga a fase a declarar janela. */
export const ORIGEM_DATA_PROPRIA = 'PROPRIA';

/**
 * O que a fase escolhida exige, lido do catálogo — nunca declarado pelo
 * operador. É a diferença entre perguntar "esta fase permite recurso?" e
 * descobrir que ela permite porque produz resultado não definitivo.
 */
export interface ExigenciasDaFase {
  readonly janelaObrigatoria: boolean;
  readonly exigeAtoProduzido: boolean;
  readonly admiteRecurso: boolean;
  readonly agrupaEtapas: boolean;
}

export function exigenciasDe(fase: FaseCanonicaDto): ExigenciasDaFase {
  return {
    janelaObrigatoria: fase.origemData === ORIGEM_DATA_PROPRIA,
    exigeAtoProduzido: fase.produzResultado,
    admiteRecurso: fase.produzResultado && !fase.resultadoDefinitivo,
    agrupaEtapas: fase.agrupaEtapas,
  };
}

/**
 * Recusa de precedência que a tela consegue antecipar.
 *
 * Só vale quando **as duas** fases da aresta estão no cronograma: a ausência de
 * uma delas não é violação, e é o que permite um cronograma curto. Quem arbitra
 * continua sendo o servidor — isto existe para avisar antes de gravar.
 */
export interface ViolacaoDePrecedencia {
  readonly antecessora: string;
  readonly sucessora: string;
  readonly motivo: 'ordem' | 'sobreposicao';
}

export function violacoesDePrecedencia(
  fases: readonly FaseDoCronograma[],
  arestas: readonly PrecedenciaFaseDto[],
): readonly ViolacaoDePrecedencia[] {
  const porCodigo = new Map(fases.map((fase) => [fase.codigo, fase]));
  const violacoes: ViolacaoDePrecedencia[] = [];

  for (const aresta of arestas) {
    const antecessora = porCodigo.get(aresta.antecessoraCodigo);
    const sucessora = porCodigo.get(aresta.sucessoraCodigo);
    if (antecessora === undefined || sucessora === undefined) continue;

    if (antecessora.ordem >= sucessora.ordem) {
      violacoes.push({
        antecessora: aresta.antecessoraCodigo,
        sucessora: aresta.sucessoraCodigo,
        motivo: 'ordem',
      });
      continue;
    }

    if (
      !aresta.permiteSobreposicao &&
      antecessora.fim !== null &&
      sucessora.inicio !== null &&
      instanteDe(antecessora.fim) > instanteDe(sucessora.inicio)
    ) {
      violacoes.push({
        antecessora: aresta.antecessoraCodigo,
        sucessora: aresta.sucessoraCodigo,
        motivo: 'sobreposicao',
      });
    }
  }

  return violacoes;
}

/**
 * Trocar a ordem entre duas fases que permanecem no cronograma forma um ciclo
 * que o servidor não consegue persistir numa chamada só — cada linha precisa que
 * a outra libere o valor primeiro. A recusa orienta a mover uma delas para uma
 * ordem livre antes de fechar o ciclo, e a tela evita chegar lá renumerando a
 * lista inteira de forma sequencial.
 *
 * Uma cadeia que termina numa ordem livre, ou na ordem de uma fase removida, não
 * é ciclo: a remoção libera o valor.
 */
export function trocaFechaCiclo(
  antes: readonly FaseDoCronograma[],
  depois: readonly FaseDoCronograma[],
): boolean {
  const anteriores = new Map(antes.map((fase) => [fase.faseCanonicaId, fase]));
  const novas = new Map(depois.map((fase) => [fase.faseCanonicaId, fase]));

  const retidaNaOrdem = new Map<number, string>();
  for (const [id, fase] of anteriores) {
    if (novas.has(id)) retidaNaOrdem.set(fase.ordem, id);
  }

  const estado = new Map<string, 'visitando' | 'concluido'>();
  for (const inicial of anteriores.keys()) {
    if (estado.has(inicial)) continue;

    const caminho: string[] = [];
    let atual: string | undefined = inicial;

    while (atual !== undefined) {
      const jaVisto = estado.get(atual);
      if (jaVisto !== undefined) {
        if (jaVisto === 'visitando') return true;
        break;
      }

      const nova = novas.get(atual);
      const anterior = anteriores.get(atual);
      if (nova === undefined || anterior === undefined || nova.ordem === anterior.ordem) break;

      estado.set(atual, 'visitando');
      caminho.push(atual);
      atual = retidaNaOrdem.get(nova.ordem);
    }

    for (const visitado of caminho) estado.set(visitado, 'concluido');
  }

  return false;
}

/**
 * Compara janelas pelo instante que elas representam, não pelo texto: dois
 * mesmos momentos escritos com deslocamentos diferentes precisam comparar
 * iguais, e a ordem lexicográfica do texto os separaria.
 */
function instanteDe(valor: string): number {
  return Date.parse(valor);
}

/** Renumera a lista de 1 a N, na ordem em que ela está. */
export function renumerar(fases: readonly FaseDoCronograma[]): readonly FaseDoCronograma[] {
  return fases.map((fase, indice) => ({ ...fase, ordem: indice + 1 }));
}

/**
 * Uma etapa compõe a nota quando pontua e declara peso. Havendo etapas, ao menos
 * uma precisa fazê-lo: sem nenhuma, o divisor da média seria zero, e o agregado
 * recusa com uma mensagem que fala de nota final, não de etapa.
 */
export function componeNota(etapa: EtapaPontuada): boolean {
  const pontua = etapa.carater === 'classificatoria' || etapa.carater === 'ambas';
  return pontua && etapa.peso.trim() !== '';
}

/**
 * Converte o texto do campo para o número que o comando recebe.
 *
 * Vírgula é o separador decimal que o operador digita; ponto é agrupador de
 * milhar na mesma escrita. `Number` sozinho leria `1.000` como 1 — a mesma
 * armadilha que o valor da taxa já corrigiu.
 */
export function comoNumero(texto: string): number | null {
  const limpo = texto.trim();
  if (limpo === '') return null;

  const numero = Number(limpo.replaceAll('.', '').replace(',', '.'));
  return Number.isFinite(numero) ? numero : null;
}
