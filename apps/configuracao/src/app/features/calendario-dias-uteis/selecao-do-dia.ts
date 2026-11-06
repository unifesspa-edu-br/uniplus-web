import { Injectable, computed, signal } from '@angular/core';
import { formatIsoDateLong } from '@uniplus/shared-data/utils';
import type { CelulaCalendarioMensal } from './calendario-mensal.util';

/** O dia da grade que a pessoa abriu, o painel dele e a prévia sobre a grade. */
@Injectable()
export class SelecaoDoDia {
  readonly dia = signal<CelulaCalendarioMensal | null>(null);
  readonly painelAberto = signal(false);
  readonly previa = signal<string | null>(null);

  readonly ocorrencias = computed(() => this.dia()?.ocorrencias ?? []);
  readonly titulo = computed(() => {
    const celula = this.dia();
    return celula ? formatIsoDateLong(celula.data) : '';
  });

  abrir(celula: CelulaCalendarioMensal): void {
    this.dia.set(celula);
    this.painelAberto.set(true);
  }

  fecharPainel(): void {
    this.painelAberto.set(false);
  }

  /** A restauração de foco do painel reabriria a prévia do botão que o abriu: fecha-se junto. */
  aoFecharPainel(): void {
    this.previa.set(null);
  }

  limpar(): void {
    this.painelAberto.set(false);
    this.dia.set(null);
    this.previa.set(null);
  }
}
