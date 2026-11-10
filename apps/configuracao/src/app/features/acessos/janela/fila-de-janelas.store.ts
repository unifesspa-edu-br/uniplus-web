import { Injectable } from '@angular/core';
import type { ItemDaFilaDeJanelasDto } from '@uniplus/shared-data/autorizacao';
import { FilaPorEtapaStore } from '../fila-por-etapa.store';

/** As janelas de migração abertas em que a pessoa tem o que decidir numa etapa. */
@Injectable()
export class FilaDeJanelasStore extends FilaPorEtapaStore<ItemDaFilaDeJanelasDto> {
  constructor() {
    super('janelas-de-migracao');
  }
}
