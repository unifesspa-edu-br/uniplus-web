import { ChangeDetectionStrategy, Component } from '@angular/core';

/** O aviso sob a grade: pesos definidos por processo seletivo, sem soma fixa, e o que é o corte. */
@Component({
  selector: 'p[cfgPesosEnemNota]',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    Os pesos das áreas são definidos pela instituição em cada processo seletivo — não há soma fixa;
    o sistema registra os valores informados sem bloquear. O corte de uma área é a nota mínima
    exigida nela: aparece abaixo do peso quando existe e não entra em cálculo de soma.
  `,
  host: { class: 'grid-note' },
})
export class PesosEnemNotaComponent {}
