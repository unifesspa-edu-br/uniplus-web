import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
} from '@angular/core';

import { focarAposRenderizar } from '../foco-apos-renderizar';
import { emOrdem, type RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { RecusasDoCampoComponent } from '../recusas/recusas-do-campo.component';

/**
 * As recusas da API à configuração de um recurso, na ordem em que a pessoa deve lê-las, cada uma
 * com a mensagem, o código, a página e o botão "Ir ao campo". As que a pessoa já tocou por baixo
 * seguem à vista, com a nota que diz que serão conferidas de novo. Não é região viva: a recusa
 * chega junto do campo e é anunciada ali.
 *
 * Quem usa diz, por `alvos`, onde o foco vai para cada campo recusado, do preferido ao de reserva.
 */
@Component({
  selector: 'sel-recusas-da-configuracao-do-recurso',
  imports: [RecusasDoCampoComponent],
  template: `
    @if (ordenadas().length > 0) {
      <ul class="u-list" role="list">
        @for (recusa of ordenadas(); track recusa.campo + recusa.codigo) {
          <li>
            <sel-recusas-do-campo [recusas]="[recusa]" />
            <button class="btn btn--tertiary" type="button" (click)="irAoCampo(recusa)">
              Ir ao campo
            </button>
          </li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class RecusasDaConfiguracaoDoRecursoComponent {
  private readonly injetor = inject(Injector);

  readonly recusas = input.required<readonly RecusaOrdenada[]>();
  /** Os destinos de foco do campo recusado, do preferido ao de reserva. */
  readonly alvos = input.required<(campo: string) => readonly string[]>();

  protected readonly ordenadas = computed(() => emOrdem(this.recusas()));

  protected irAoCampo(recusa: RecusaOrdenada): void {
    focarAposRenderizar(this.injetor, ...this.alvos()(recusa.campo));
  }
}
