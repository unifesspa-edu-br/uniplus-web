import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';

@Component({
  selector: 'sel-step-06-formula',
  standalone: true,
  templateUrl: './step-06-formula.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step06FormulaComponent {
  readonly store = inject(ProcessoSeletivoStore);
  readonly preview = computed(() => {
    switch (this.store.draft().formula.agregacao) {
      case 'SOMA_PONDERADA_COM_FATOR':
        return 'NOTA_FINAL = Σ(NOTA_ETAPA × PESO) / FATOR';
      case 'MEDIA_SIMPLES':
        return 'NOTA_FINAL = Σ NOTAS / N ETAPAS';
      case 'MEDIA_PONDERADA_ENEM':
        return 'NOTA_FINAL = Σ(NOTA_ÁREA_ENEM × PESO_DO_CURSO) / Σ PESOS';
      default:
        return 'NOTA_FINAL = ((N1×1) + (N2×1) + (N3×1) + (N4×1) + (N5×1)) / 5';
    }
  });
}
