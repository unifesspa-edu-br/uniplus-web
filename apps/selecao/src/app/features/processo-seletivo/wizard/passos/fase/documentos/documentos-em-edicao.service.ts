import { effect, inject, Injectable, signal, untracked } from '@angular/core';

import { FaseEmEdicao } from '../fase-em-edicao';
import { ExigenciasDaFaseStore } from './exigencias-da-fase.store';
import { RecusasDasExigencias } from './recusas-das-exigencias.service';

@Injectable()
export class DocumentosEmEdicao {
  private readonly fase = inject(FaseEmEdicao);
  private readonly exigencias = inject(ExigenciasDaFaseStore);
  private readonly recusas = inject(RecusasDasExigencias, { optional: true });
  private readonly abertos = signal<ReadonlySet<string>>(new Set());

  constructor() {
    effect(() => {
      const identificadores = new Set(
        this.recusas?.todas().map((recusa) => recusa.identificadorDaRegra),
      );
      for (const exigencia of this.exigencias.declaracoesDaFase()) {
        if (identificadores.has(exigencia.identificadorNoRascunho)) {
          untracked(() => this.alternar(exigencia.identificadorNoRascunho, true));
        }
      }
    });
  }

  private chave(id: string): string {
    return `${this.fase.faseDoRascunho()?.codigo ?? ''}|${id}`;
  }

  aberto(id: string): boolean {
    return this.abertos().has(this.chave(id));
  }

  alternar(id: string, aberto = !this.aberto(id)): void {
    const chave = this.chave(id);
    this.abertos.update((atuais) => {
      const proximos = new Set(atuais);
      if (aberto) proximos.add(chave);
      else proximos.delete(chave);
      return proximos;
    });
  }
}
