import { ChangeDetectionStrategy, Component, input, linkedSignal } from '@angular/core';

let sementeDoRecolhivel = 0;

/**
 * Um bloco que abre e fecha pelo título: o botão do título diz, por `aria-expanded`, se o conteúdo
 * está à vista, e a seta que gira mostra o mesmo sem depender de cor. Serve ao conteúdo de consulta
 * que alongaria a tela se ficasse sempre aberto.
 */
@Component({
  selector: 'ui-recolhivel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="recolhivel" [attr.aria-labelledby]="tituloId">
      <h3 class="recolhivel__titulo" [id]="tituloId">
        <button
          type="button"
          class="recolhivel__alternar"
          [attr.aria-expanded]="estaAberto()"
          [attr.aria-controls]="corpoId"
          (click)="estaAberto.set(!estaAberto())"
        >
          <span class="recolhivel__seta" aria-hidden="true"></span>
          <span>{{ titulo() }}</span>
        </button>
      </h3>
      <div class="recolhivel__corpo" [id]="corpoId" [hidden]="!estaAberto()">
        <ng-content />
      </div>
    </section>
  `,
})
export class RecolhivelComponent {
  private readonly semente = (sementeDoRecolhivel += 1);

  readonly titulo = input.required<string>();
  /** Se o bloco chega aberto; depois, quem abre e fecha é o usuário. */
  readonly aberto = input(false);

  protected readonly tituloId = `ui-recolhivel-${this.semente}`;
  protected readonly corpoId = `ui-recolhivel-${this.semente}-corpo`;
  protected readonly estaAberto = linkedSignal(() => this.aberto());
}
