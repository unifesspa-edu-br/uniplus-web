import type { PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import type { FaseDoCronograma } from '../../processo-seletivo.models';

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
 * a outra libere o valor primeiro.
 *
 * Renumerar a lista sequencialmente **não** evita isso: trocar duas fases de
 * lugar e renumerar produz precisamente essa permutação, e é a reordenação mais
 * comum que existe. Quem move fase na tela guarda a operação com esta função e,
 * quando ela acusa, segue o que a recusa do domínio orienta — mover uma das
 * fases para uma ordem livre numa gravação e fechar o ciclo na seguinte.
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
export function instanteDe(valor: string): number {
  return Date.parse(valor);
}
