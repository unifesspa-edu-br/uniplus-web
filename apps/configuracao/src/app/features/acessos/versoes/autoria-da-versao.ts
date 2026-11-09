import type { ItemDaFilaDeVersoesDto } from '@uniplus/shared-data/autorizacao';

/**
 * Diz se quem lê propôs a versão. O contrato da fila ainda não traz essa informação: até lá a
 * tela oferece a decisão e mostra a recusa da API junto à ação. Este é o único ponto a trocar.
 */
export function propostaPorQuemLe(_item: ItemDaFilaDeVersoesDto): boolean {
  return false;
}
