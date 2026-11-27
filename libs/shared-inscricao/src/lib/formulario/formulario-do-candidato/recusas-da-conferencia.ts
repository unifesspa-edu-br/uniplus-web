import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type { ProblemValidationError } from '@uniplus/shared-core/http';

/** Uma recusa do servidor: o que ele disse e, quando a recusa aponta um elemento, onde. */
export interface RecusaDaConferencia {
  readonly mensagem: string;
  readonly campo: string | null;
}

/** As causas do problema, na ordem recebida; a causa sem campo, ou com o campo vazio, não diz onde. */
export function recusasDaConferencia(
  causas: ReadonlyArray<ProblemValidationError> | undefined,
): readonly RecusaDaConferencia[] {
  return (causas ?? []).map((causa) => ({
    mensagem: causa.message,
    campo: causa.field ? causa.field : null,
  }));
}

/**
 * O resumo das recusas que o servidor devolveu para as regras: o total e uma lista com uma recusa por
 * item. Ao aparecer, o foco vai ao título, para o leitor de tela e o teclado começarem por ele.
 */
@Component({
  selector: 'insc-recusas-da-conferencia',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="alert alert--danger" [attr.aria-labelledby]="idBase() + '-titulo'">
      <span class="alert__icon" aria-hidden="true">!</span>
      <div class="alert__body">
        <p
          #titulo
          class="alert__title"
          role="heading"
          aria-level="3"
          tabindex="-1"
          [id]="idBase() + '-titulo'"
        >
          O servidor não conferiu a simulação: {{ total() }}
        </p>
        <ul class="recusas-da-conferencia__lista">
          @for (recusa of recusas(); track $index) {
            <li>
              <span>{{ recusa.mensagem }}</span>
              @if (recusa.campo !== null) {
                <span class="recusas-da-conferencia__onde">
                  Onde: <code>{{ recusa.campo }}</code>
                </span>
              }
            </li>
          }
        </ul>
      </div>
    </section>
  `,
  styles: `
    .recusas-da-conferencia__lista {
      overflow-wrap: anywhere;
      display: grid;
      gap: var(--space-2);
      margin: 0;
      padding-inline-start: var(--space-4);
    }
    .recusas-da-conferencia__onde {
      display: block;
      color: var(--text-secondary);
      font-size: var(--text-sm);
    }
  `,
})
export class RecusasDaConferenciaComponent {
  readonly recusas = input.required<readonly RecusaDaConferencia[]>();
  readonly idBase = input<string>('recusas-da-conferencia');

  private readonly titulo = viewChild.required<ElementRef<HTMLElement>>('titulo');
  private readonly injector = inject(Injector);

  protected readonly total = computed(() => {
    const quantidade = this.recusas().length;
    return quantidade === 1 ? '1 recusa' : `${quantidade} recusas`;
  });

  /** A cada lista nova o foco volta ao título, mesmo quando o componente é reaproveitado. */
  constructor() {
    effect(() => {
      this.recusas();
      afterNextRender(() => this.titulo().nativeElement.focus(), { injector: this.injector });
    });
  }
}
