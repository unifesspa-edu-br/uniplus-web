import { Injectable, signal } from '@angular/core';

import type { RecusaDaExigencia } from '../../cronograma/servicos/gravacao-das-exigencias-documentais.service';

@Injectable()
export class RecusasDasExigencias {
  private readonly guardadas = signal<readonly RecusaDaExigencia[]>([]);

  registrar(recusas: readonly RecusaDaExigencia[]): void {
    this.guardadas.set(recusas);
  }

  doCampo(identificadorDaRegra: string, campo: string): readonly RecusaDaExigencia[] {
    return this.guardadas().filter(
      (recusa) => recusa.identificadorDaRegra === identificadorDaRegra && recusa.campo === campo,
    );
  }

  limparCampo(identificadorDaRegra: string, campo: string): void {
    this.guardadas.update((recusas) =>
      recusas.filter(
        (recusa) => recusa.identificadorDaRegra !== identificadorDaRegra || recusa.campo !== campo,
      ),
    );
  }

  limpar(): void {
    this.guardadas.set([]);
  }
}
