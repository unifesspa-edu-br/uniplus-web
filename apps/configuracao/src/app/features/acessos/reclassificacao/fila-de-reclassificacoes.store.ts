import { Injectable } from '@angular/core';
import type { ItemDaFilaDeReclassificacoesDto } from '@uniplus/shared-data/autorizacao';
import { FilaPorEtapaStore } from '../fila-por-etapa.store';

/** As permissões reclassificadas com concessões suspensas que ainda aguardam a etapa. */
@Injectable()
export class FilaDeReclassificacoesStore extends FilaPorEtapaStore<ItemDaFilaDeReclassificacoesDto> {
  constructor() {
    super('reclassificacoes');
  }
}
