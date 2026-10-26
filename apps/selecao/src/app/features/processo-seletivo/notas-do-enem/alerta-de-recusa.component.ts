import { ChangeDetectionStrategy, Component, ElementRef, input, viewChild } from '@angular/core';

import type { RecusaExplicada } from './recusas-do-enem';

/** A recusa explicada: o que houve, o que fazer e, quando a falha não é da API, o código para a equipe. */
@Component({
  selector: 'sel-alerta-de-recusa',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = recusa();
    <div
      #alerta
      class="alert"
      [class.alert--danger]="r.nivel === 'danger'"
      [class.alert--warning]="r.nivel === 'warning'"
      role="alert"
      tabindex="-1"
    >
      <span class="alert__icon" aria-hidden="true">!</span>
      <div class="alert__body">
        <p class="alert__title">{{ r.titulo }}</p>
        <p class="alert__msg">{{ r.explicacao }}</p>
        @if (r.detalhe; as detalhe) {
          <p class="alert__msg">{{ detalhe }}</p>
        }
        <p class="alert__msg">{{ r.orientacao }}</p>
        @if (r.traceId; as codigo) {
          <p class="alert__msg">Código para a equipe técnica: {{ codigo }}</p>
        }
      </div>
    </div>
  `,
})
export class AlertaDeRecusaComponent {
  readonly recusa = input.required<RecusaExplicada>();

  private readonly alerta = viewChild.required<ElementRef<HTMLElement>>('alerta');

  /** Leva o foco ao alerta, para o leitor de tela anunciar a recusa e o teclado seguir dela. */
  focar(): void {
    this.alerta().nativeElement.focus();
  }
}
